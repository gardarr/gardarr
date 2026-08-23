// Package rss is the thin per-instance service internal/repository/worker
// delegates to, mirroring internal/services/task/worker: it just adapts
// internal/repository/rss/worker's synchronous calls to the ctx-carrying
// interfaces.RSSService signature.
package rss

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/interfaces"
	repository "github.com/jfxdev/gardarr/internal/repository/rss/worker"
	"github.com/jfxdev/go-qbt"
)

type service struct {
	repository interfaces.RSSRepositoryInterface
}

func New(client *qbt.Client) interfaces.RSSService {
	return &service{repository: repository.New(client)}
}

func (s *service) ListFeeds(ctx context.Context, withData bool) (map[string]*entities.RSSFeed, error) {
	return s.repository.ListFeeds(withData)
}

func (s *service) AddFeed(ctx context.Context, feedURL, path string) error {
	return s.repository.AddFeed(feedURL, path)
}

func (s *service) RemoveFeed(ctx context.Context, path string) error {
	return s.repository.RemoveFeed(path)
}

func (s *service) SetFeedURL(ctx context.Context, path, feedURL string) error {
	return s.repository.SetFeedURL(path, feedURL)
}

func (s *service) AddFolder(ctx context.Context, path string) error {
	return s.repository.AddFolder(path)
}

func (s *service) MoveItem(ctx context.Context, itemPath, destPath string) error {
	return s.repository.MoveItem(itemPath, destPath)
}

func (s *service) RefreshItem(ctx context.Context, itemPath string) error {
	return s.repository.RefreshItem(itemPath)
}

func (s *service) MarkAsRead(ctx context.Context, itemPath, articleID string) error {
	return s.repository.MarkAsRead(itemPath, articleID)
}

func (s *service) ListRules(ctx context.Context) (map[string]*entities.RSSRule, error) {
	return s.repository.ListRules()
}

func (s *service) SetRule(ctx context.Context, ruleName string, rule entities.RSSRule) error {
	return s.repository.SetRule(ruleName, rule)
}

func (s *service) RenameRule(ctx context.Context, ruleName, newRuleName string) error {
	return s.repository.RenameRule(ruleName, newRuleName)
}

func (s *service) RemoveRule(ctx context.Context, ruleName string) error {
	return s.repository.RemoveRule(ruleName)
}

func (s *service) MatchingArticles(ctx context.Context, ruleName string) (map[string][]string, error) {
	return s.repository.MatchingArticles(ruleName)
}
