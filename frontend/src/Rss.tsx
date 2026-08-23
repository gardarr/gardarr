import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Rss as RssIcon,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Pencil,
  FlaskConical,
  AlertTriangle,
  Rows3,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { rssService } from "./services/rss";
import { workerService } from "./services/workers";
import type { Worker } from "./types/worker";
import type { RSSFeed, RSSRule, RSSMatchingArticles, RSSWorkerErrors } from "./types/rss";
import { AddRSSFeedModal } from "./components/rss/AddRSSFeedModal";
import { RSSRuleModal } from "./components/rss/RSSRuleModal";
import { RSSMatchingArticlesModal } from "./components/rss/RSSMatchingArticlesModal";

function Rss() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [rules, setRules] = useState<RSSRule[]>([]);
  const [feedErrors, setFeedErrors] = useState<RSSWorkerErrors>({});
  const [ruleErrors, setRuleErrors] = useState<RSSWorkerErrors>({});
  const [loading, setLoading] = useState(true);

  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedToRemove, setFeedToRemove] = useState<RSSFeed | null>(null);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RSSRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<RSSRule | null>(null);

  const [matchingRule, setMatchingRule] = useState<RSSRule | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matches, setMatches] = useState<RSSMatchingArticles | null>(null);

  const workerNameById = useMemo(() => {
    const map = new Map<string, string>();
    workers.forEach((w) => map.set(w.uuid, w.name));
    return map;
  }, [workers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workersRes, feedsRes, rulesRes] = await Promise.all([
        workerService.listWorkersBasic(),
        rssService.listAllFeeds(),
        rssService.listAllRules(),
      ]);

      if (workersRes.data) setWorkers(workersRes.data);
      if (feedsRes.data) {
        setFeeds(feedsRes.data.feeds || []);
        setFeedErrors(feedsRes.data.errors || {});
      } else if (feedsRes.error) {
        toast.error(feedsRes.error);
      }
      if (rulesRes.data) {
        setRules(rulesRes.data.rules || []);
        setRuleErrors(rulesRes.data.errors || {});
      } else if (rulesRes.error) {
        toast.error(rulesRes.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("rss.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddFeed = async (workerId: string, url: string, path: string) => {
    const response = await rssService.addFeed(workerId, { url, path });
    if (response.error) {
      toast.error(response.error);
      throw new Error(response.error);
    }
    toast.success(t("rss.notifications.feedAdded"));
    await load();
  };

  const handleRemoveFeed = async () => {
    if (!feedToRemove?.worker_id) return;
    const response = await rssService.removeFeed(feedToRemove.worker_id, feedToRemove.path);
    if (response.error) {
      toast.error(response.error);
    } else {
      toast.success(t("rss.notifications.feedRemoved"));
      setFeedToRemove(null);
      await load();
    }
  };

  const handleRefreshFeed = async (feed: RSSFeed) => {
    if (!feed.worker_id) return;
    const response = await rssService.refreshItem(feed.worker_id, feed.path);
    if (response.error) {
      toast.error(response.error);
    } else {
      toast.success(t("rss.notifications.feedRefreshRequested"));
    }
  };

  const handleSaveRule = async (workerId: string, ruleName: string, data: Parameters<typeof rssService.setRule>[2]) => {
    const response = await rssService.setRule(workerId, ruleName, data);
    if (response.error) {
      toast.error(response.error);
      throw new Error(response.error);
    }
    toast.success(t("rss.notifications.ruleSaved"));
    await load();
  };

  const handleToggleRule = async (rule: RSSRule) => {
    if (!rule.worker_id) return;
    const response = await rssService.setRule(rule.worker_id, rule.name, {
      enabled: !rule.enabled,
      must_contain: rule.must_contain,
      must_not_contain: rule.must_not_contain,
      use_regex: rule.use_regex,
      episode_filter: rule.episode_filter,
      smart_filter: rule.smart_filter,
      affected_feeds: rule.affected_feeds || [],
      ignore_days: rule.ignore_days,
      add_paused: rule.add_paused,
      assigned_category: rule.assigned_category,
      save_path: rule.save_path,
      torrent_content_layout: rule.torrent_content_layout,
    });
    if (response.error) {
      toast.error(response.error);
    } else {
      await load();
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete?.worker_id) return;
    const response = await rssService.removeRule(ruleToDelete.worker_id, ruleToDelete.name);
    if (response.error) {
      toast.error(response.error);
    } else {
      toast.success(t("rss.notifications.ruleDeleted"));
      setRuleToDelete(null);
      await load();
    }
  };

  const handleTestRule = async (rule: RSSRule) => {
    if (!rule.worker_id) return;
    setMatchingRule(rule);
    setMatches(null);
    setMatchingLoading(true);
    const response = await rssService.matchingArticles(rule.worker_id, rule.name);
    setMatchingLoading(false);
    if (response.error) {
      toast.error(response.error);
    } else if (response.data) {
      setMatches(response.data);
    }
  };

  const workerErrorBanners = (errors: RSSWorkerErrors) => {
    const entries = Object.entries(errors);
    if (entries.length === 0) return null;
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          {entries.map(([workerId, message]) => (
            <p key={workerId}>
              {workerNameById.get(workerId) || workerId}: {message}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <RssIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("rss.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("rss.subtitle")}</p>
          </div>
        </div>
        <Button onClick={load} variant="outline" size="icon" aria-label={t("common.refresh")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t("rss.loading")}</span>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="feeds">
          <TabsList>
            <TabsTrigger value="feeds">{t("rss.tabs.feeds")}</TabsTrigger>
            <TabsTrigger value="rules">{t("rss.tabs.rules")}</TabsTrigger>
          </TabsList>

          <TabsContent value="feeds" className="space-y-4 mt-4">
            {workerErrorBanners(feedErrors)}

            <div className="flex justify-end">
              <Button onClick={() => setShowAddFeed(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("rss.addFeed")}
              </Button>
            </div>

            {feeds.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <RssIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("rss.noFeeds")}</h3>
                  <p className="text-muted-foreground text-center mb-4">{t("rss.noFeedsDesc")}</p>
                  <Button onClick={() => setShowAddFeed(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("rss.addFeed")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {feeds.map((feed) => (
                  <Card key={`${feed.worker_id}-${feed.path}`}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <RssIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{feed.title || feed.path}</h3>
                          {feed.worker_id && (
                            <Badge variant="outline" className="text-xs">
                              {workerNameById.get(feed.worker_id) || feed.worker_id}
                            </Badge>
                          )}
                          {feed.has_error && (
                            <Badge variant="destructive" className="text-xs">
                              {t("rss.feedError")}
                            </Badge>
                          )}
                          {feed.is_loading && (
                            <Badge variant="secondary" className="text-xs">
                              {t("rss.feedLoading")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{feed.url || feed.path}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRefreshFeed(feed)} aria-label={t("rss.refreshFeed")}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setFeedToRemove(feed)} aria-label={t("common.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rules" className="space-y-4 mt-4">
            {workerErrorBanners(ruleErrors)}

            <div className="flex justify-end">
              <Button onClick={() => { setEditingRule(null); setShowRuleModal(true); }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("rss.addRule")}
              </Button>
            </div>

            {rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Rows3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("rss.noRules")}</h3>
                  <p className="text-muted-foreground text-center mb-4">{t("rss.noRulesDesc")}</p>
                  <Button onClick={() => { setEditingRule(null); setShowRuleModal(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("rss.addRule")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {rules.map((rule) => (
                  <Card key={`${rule.worker_id}-${rule.name}`}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{rule.name}</h3>
                          {rule.worker_id && (
                            <Badge variant="outline" className="text-xs">
                              {workerNameById.get(rule.worker_id) || rule.worker_id}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {rule.must_contain && `+${rule.must_contain}`}{" "}
                          {rule.must_not_contain && `-${rule.must_not_contain}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleTestRule(rule)} aria-label={t("rss.testRule")}>
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setEditingRule(rule); setShowRuleModal(true); }} aria-label={t("common.edit", { defaultValue: "Edit" })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setRuleToDelete(rule)} aria-label={t("common.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AddRSSFeedModal
        open={showAddFeed}
        onOpenChange={setShowAddFeed}
        workers={workers}
        onAdd={handleAddFeed}
      />

      <RSSRuleModal
        open={showRuleModal}
        onOpenChange={(open) => { setShowRuleModal(open); if (!open) setEditingRule(null); }}
        workers={workers}
        feeds={feeds}
        editingRule={editingRule}
        onSave={handleSaveRule}
      />

      <RSSMatchingArticlesModal
        open={Boolean(matchingRule)}
        onOpenChange={(open) => !open && setMatchingRule(null)}
        ruleName={matchingRule?.name || ""}
        loading={matchingLoading}
        matches={matches}
      />

      <Dialog open={Boolean(feedToRemove)} onOpenChange={(open) => !open && setFeedToRemove(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rss.removeFeedConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("rss.removeFeedConfirmMessage", { name: feedToRemove?.title || feedToRemove?.path })}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setFeedToRemove(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleRemoveFeed}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(ruleToDelete)} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rss.deleteRuleConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("rss.deleteRuleConfirmMessage", { name: ruleToDelete?.name })}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Rss;
