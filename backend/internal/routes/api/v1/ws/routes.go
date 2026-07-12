package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
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
}

func NewModule(router *gin.RouterGroup, db *database.Database, hub *websocketSvc.Hub, allowedOrigins []string) *Module {
	return &Module{
		group:          router.Group("/ws"),
		hub:            hub,
		db:             db,
		allowedOrigins: allowedOrigins,
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
				return true
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
	sessionToken, _ := c.Cookie("session_token")

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
	go readPump(client, conn)
}

func readPump(c *websocketSvc.Client, conn *websocket.Conn) {
	defer func() {
		c.Close()
		conn.Close()
	}()
	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	
	var lastSync time.Time

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("websocket unexpected close error", "error", err)
			}
			break
		}
		// Parse message from client
		var msg struct {
			Action string `json:"action"`
		}
		if err := json.Unmarshal(message, &msg); err == nil {
			if msg.Action == "request_sync" {
				// Rate limit to once every 5 seconds
				if time.Since(lastSync) > 5*time.Second {
					lastSync = time.Now()
					go c.Hub.SendInitialState(c)
				} else {
					slog.Debug("request_sync rate limited", "client_id", c.ID)
				}
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
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.WriteJSON(message); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
