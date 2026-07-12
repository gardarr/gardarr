package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/services/session"
	websocketSvc "github.com/jfxdev/gardarr/internal/services/websocket"
)

// Upgrader is instantiated inside serveWs to use module configurations

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Module struct {
	group          *gin.RouterGroup
	hub            *websocketSvc.Hub
	db             *database.Database
	allowedOrigins []string
	sessionSvc     *session.Service
}

func NewModule(router *gin.RouterGroup, db *database.Database, hub *websocketSvc.Hub, allowedOrigins []string) *Module {
	return &Module{
		group:          router.Group("/ws"),
		hub:            hub,
		db:             db,
		allowedOrigins: allowedOrigins,
		sessionSvc:     session.NewService(db),
	}
}

func (m *Module) Register() {
	// We use the SessionMiddleware, which expects a cookie or auth header.
	// In WebSockets, browsers only send cookies automatically.
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.GET("/torrents", m.serveWs)
}

func (m *Module) serveWs(c *gin.Context) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				slog.Warn("WebSocket origin rejected: missing Origin header")
				return false
			}
			for _, allowed := range m.allowedOrigins {
				if origin == allowed {
					return true
				}
			}
			slog.Warn("WebSocket origin rejected", "origin", origin)
			return false
		},
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("failed to upgrade websocket connection", "error", err)
		return
	}

	// Extract session token from cookie to allow forced drops on logout
	sessionToken, _ := c.Cookie(middlewares.SessionCookieName)

	client := &websocketSvc.Client{
		ID:        uuid.New(),
		SessionID: sessionToken,
		Hub:       m.hub,
		Send:      make(chan *websocketSvc.WSEvent, 256),
	}

	client.Hub.Register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go writePump(client, conn)
	go readPump(client, conn, m.sessionSvc, sessionToken)
}

func readPump(c *websocketSvc.Client, conn *websocket.Conn, sessionSvc *session.Service, sessionToken string) {
	defer func() {
		c.Close()
		conn.Close()
	}()
	conn.SetReadLimit(maxMessageSize)
	_ = conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(pongWait)) })

	stopSessionCheck := make(chan struct{})
	defer close(stopSessionCheck)
	go monitorSession(sessionSvc, sessionToken, conn, stopSessionCheck)

	var lastSync time.Time

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			logUnexpectedCloseError(err)
			break
		}
		handleClientMessage(c, message, &lastSync)
	}
}

// logUnexpectedCloseError logs read errors that indicate an abnormal disconnect,
// ignoring the routine close cases (going away, abnormal closure already logged elsewhere).
func logUnexpectedCloseError(err error) {
	if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
		slog.Error("websocket unexpected close error", "error", err)
	}
}

// handleClientMessage parses a single client message and, for a rate-limited
// "request_sync" action, triggers an async INITIAL_STATE resend.
func handleClientMessage(c *websocketSvc.Client, message []byte, lastSync *time.Time) {
	var msg struct {
		Action string `json:"action"`
	}
	if err := json.Unmarshal(message, &msg); err != nil || msg.Action != "request_sync" {
		return
	}

	// Rate limit to once every 5 seconds
	if time.Since(*lastSync) <= 5*time.Second {
		slog.Debug("request_sync rate limited", "client_id", c.ID)
		return
	}

	*lastSync = time.Now()
	go c.Hub.SendInitialState(c)
}

// monitorSession periodically revalidates the session backing this connection
// (expiry is only checked lazily by ValidateSession, so a WS client that never
// hits an HTTP endpoint again would otherwise never notice its session died)
// and forcibly closes the connection once the session is no longer valid.
func monitorSession(sessionSvc *session.Service, sessionToken string, conn *websocket.Conn, stop <-chan struct{}) {
	if sessionToken == "" {
		return
	}

	ticker := time.NewTicker(pongWait)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, _, err := sessionSvc.ValidateSession(ctx, sessionToken)
			cancel()
			if err != nil {
				slog.Info("websocket session no longer valid, closing connection")
				conn.Close()
				return
			}
		}
	}
}

func writePump(c *websocketSvc.Client, conn *websocket.Conn) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.WriteJSON(message); err != nil {
				return
			}
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
