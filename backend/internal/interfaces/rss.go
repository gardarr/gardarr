package interfaces

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
)

// RSSService is the per-instance RSS surface exposed to internal/repository/worker.
type RSSService interface {
	ListFeeds(ctx context.Context, withData bool) (map[string]*entities.RSSFeed, error)
	AddFeed(ctx context.Context, feedURL, path string) error
	RemoveFeed(ctx context.Context, path string) error
	SetFeedURL(ctx context.Context, path, feedURL string) error
	AddFolder(ctx context.Context, path string) error
	MoveItem(ctx context.Context, itemPath, destPath string) error
	RefreshItem(ctx context.Context, itemPath string) error
	MarkAsRead(ctx context.Context, itemPath, articleID string) error
	ListRules(ctx context.Context) (map[string]*entities.RSSRule, error)
	SetRule(ctx context.Context, ruleName string, rule entities.RSSRule) error
	RenameRule(ctx context.Context, ruleName, newRuleName string) error
	RemoveRule(ctx context.Context, ruleName string) error
	MatchingArticles(ctx context.Context, ruleName string) (map[string][]string, error)
}

// RSSRepositoryInterface is the qbt.Client-backed implementation RSSService wraps.
type RSSRepositoryInterface interface {
	ListFeeds(withData bool) (map[string]*entities.RSSFeed, error)
	AddFeed(feedURL, path string) error
	RemoveFeed(path string) error
	SetFeedURL(path, feedURL string) error
	AddFolder(path string) error
	MoveItem(itemPath, destPath string) error
	RefreshItem(itemPath string) error
	MarkAsRead(itemPath, articleID string) error
	ListRules() (map[string]*entities.RSSRule, error)
	SetRule(ruleName string, rule entities.RSSRule) error
	RenameRule(ruleName, newRuleName string) error
	RemoveRule(ruleName string) error
	MatchingArticles(ruleName string) (map[string][]string, error)
}
