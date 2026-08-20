import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  Pencil,
  Merge,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tagService } from "./services/tags";
import type { Tag, CreateTagRequest, UpdateTagRequest, TagOperationResult, TagConflictReport } from "./types/tag";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AddTagModal } from "./components/AddTagModal";
import { MergeTagsModal } from "./components/MergeTagsModal";
import { useTagColors } from "@/contexts/tag-colors-hooks";

const DEFAULT_COLOR = "#3b82f6";

function warnIfPartialFailure(t: (key: string, opts?: Record<string, unknown>) => string, result?: TagOperationResult) {
  const failedCount = result?.failed_workers ? Object.keys(result.failed_workers).length : 0;
  if (failedCount > 0) {
    toast.warning(t('tags.notifications.partialFailure', { count: failedCount }));
  }
}

function Tags() {
  const { t } = useTranslation();
  const { refresh: refreshTagColors } = useTagColors();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [conflicts, setConflicts] = useState<TagConflictReport | null>(null);

  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeInitialSources, setMergeInitialSources] = useState<string[]>([]);
  const [mergeInitialTarget, setMergeInitialTarget] = useState<string>("");

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tagService.listTags();

      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setTags(response.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tags.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadConflicts = useCallback(async () => {
    // Best-effort: this is a compatibility report, not core data, so a
    // failure here shouldn't block the rest of the page.
    const response = await tagService.getConflicts();
    if (response.data) {
      setConflicts(response.data);
    }
  }, []);

  useEffect(() => {
    loadTags();
    loadConflicts();
  }, [loadTags, loadConflicts]);

  const handleRefresh = () => {
    loadTags();
    loadConflicts();
  };

  const handleCreateTag = async (createForm: CreateTagRequest) => {
    try {
      const response = await tagService.createTag(createForm);
      if (response.error) {
        toast.error(response.error);
        throw new Error(response.error);
      } else if (response.data) {
        toast.success(t('tags.notifications.createSuccess'));
        refreshTagColors();
        await loadTags();
        return response.data;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tags.errors.createFailed'));
      throw err;
    }
  };

  const handleUpdateTag = async (tagId: string, updateData: UpdateTagRequest): Promise<void> => {
    try {
      const response = await tagService.updateTag(tagId, updateData);
      if (response.error) {
        toast.error(response.error);
        throw new Error(response.error);
      }
      toast.success(t('tags.notifications.updateSuccess'));
      refreshTagColors();
      await loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tags.errors.updateFailed'));
      throw err;
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      const response = await tagService.deleteTag(tagToDelete.name, tagToDelete.kind);
      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(t('tags.notifications.deleteSuccess'));
        warnIfPartialFailure(t, response.data);
        refreshTagColors();
        setShowDeleteModal(false);
        setTagToDelete(null);
        await loadTags();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tags.errors.deleteFailed'));
    }
  };

  const handleMergeSubmit = async (sources: string[], target: string) => {
    try {
      const response = sources.length === 1
        ? await tagService.renameTag({ from: sources[0], to: target })
        : await tagService.mergeTags({ sources, target });

      if (response.error) {
        toast.error(response.error);
        throw new Error(response.error);
      }

      toast.success(sources.length === 1 ? t('tags.notifications.renameSuccess') : t('tags.notifications.mergeSuccess'));
      warnIfPartialFailure(t, response.data);
      refreshTagColors();
      await loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tags.errors.mergeFailed'));
      throw err;
    }
  };

  const startEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setShowTagModal(true);
  };

  const handleTagModalClose = (open: boolean) => {
    setShowTagModal(open);
    if (!open) {
      setEditingTag(null);
    }
  };

  const openRename = (tag: Tag) => {
    setMergeInitialSources([tag.name]);
    setMergeInitialTarget("");
    setShowMergeModal(true);
  };

  // Groups tag-kind rows that share a case-insensitive name (e.g. "4k" and
  // "4K") - the cleanup the merge feature is most valuable for, per #87.
  const mergeCandidates = useMemo(() => {
    const groups = new Map<string, Tag[]>();
    for (const tag of tags) {
      if (tag.kind !== "tag") continue;
      const key = tag.name.toLowerCase();
      const group = groups.get(key) ?? [];
      group.push(tag);
      groups.set(key, group);
    }
    return Array.from(groups.values()).filter((group) => group.length > 1);
  }, [tags]);

  const openMergeForCluster = (cluster: Tag[]) => {
    const sorted = [...cluster].sort((a, b) => b.usage_count - a.usage_count);
    setMergeInitialTarget(sorted[0].name);
    setMergeInitialSources(sorted.slice(1).map((tag) => tag.name));
    setShowMergeModal(true);
  };

  const filteredTags = tags.filter((tag) => tag.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <TagIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('tags.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('tags.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button onClick={handleRefresh} variant="outline" size="icon" aria-label={t('common.refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowTagModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('tags.addTag')}
          </Button>
        </div>
      </div>

      {/* Backward-compatibility conflicts */}
      {conflicts && (conflicts.scope_conflicts.length > 0 || conflicts.grouped_tags.length > 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <h3 className="text-sm font-semibold">{t('tags.conflicts.title')}</h3>
            </div>

            {conflicts.scope_conflicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t('tags.conflicts.scopeDescription', { count: conflicts.scope_conflicts.length })}
                </p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {conflicts.scope_conflicts.map((conflict, index) => (
                    <div
                      key={`${conflict.worker_id}-${conflict.task_hash}-${conflict.scope}-${index}`}
                      className="rounded-md border bg-background px-3 py-2 text-xs"
                    >
                      <div className="font-medium truncate">{conflict.task_name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-muted-foreground">
                        <span className="font-medium">{conflict.scope}:</span>
                        {conflict.tags.map((tag) => (
                          <span key={tag} className="bg-muted px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conflicts.grouped_tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t('tags.conflicts.groupedDescription', { count: conflicts.grouped_tags.length })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {conflicts.grouped_tags.map((tag) => (
                    <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merge candidates */}
      {mergeCandidates.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <h3 className="text-sm font-semibold">{t('tags.mergeCandidates.title')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{t('tags.mergeCandidates.description')}</p>
            <div className="space-y-2">
              {mergeCandidates.map((cluster) => (
                <div
                  key={cluster.map((tag) => tag.name).join('|')}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-md border bg-background px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cluster.map((tag) => (
                      <span key={tag.id || tag.name} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || DEFAULT_COLOR }} />
                        {tag.name}
                        <span className="text-muted-foreground">({tag.usage_count})</span>
                      </span>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openMergeForCluster(cluster)}>
                    <Merge className="h-3.5 w-3.5 mr-1.5" />
                    {t('tags.mergeCandidates.merge')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('tags.search')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tags list */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('tags.loading')}</span>
          </CardContent>
        </Card>
      ) : filteredTags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TagIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('tags.noTags')}</h3>
            <p className="text-muted-foreground text-center mb-4">{t('tags.noTagsDesc')}</p>
            <Button onClick={() => setShowTagModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('tags.addTag')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card className="py-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-muted-foreground text-sm">{t('tags.fields.name')}</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-sm">{t('tags.fields.kind')}</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-sm">{t('tags.fields.usageCount')}</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-sm">{t('tags.fields.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTags.map((tag) => (
                      <tr key={tag.id || tag.name} className="hover:bg-accent/50 transition-colors border-b last:border-b-0">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: tag.color || DEFAULT_COLOR }}
                            >
                              {tag.kind === "scope" ? <Layers className="h-4.5 w-4.5 text-white" /> : <TagIcon className="h-4.5 w-4.5 text-white" />}
                            </div>
                            <h3 className="font-medium text-sm truncate">{tag.name}</h3>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground">
                            {tag.kind === "scope" ? t('tags.kindLabels.scope') : t('tags.kindLabels.tag')}
                          </span>
                        </td>
                        <td className="p-3">
                          {tag.kind === "tag" && (
                            <span className="text-xs text-muted-foreground">{tag.usage_count}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => startEditTag(tag)}
                              aria-label={t('tags.editTag', { defaultValue: 'Edit {{name}}', name: tag.name })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {tag.kind === "tag" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => openRename(tag)}
                                aria-label={t('tags.renameTagAction', { defaultValue: 'Rename {{name}}', name: tag.name })}
                              >
                                <Merge className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => { setTagToDelete(tag); setShowDeleteModal(true); }}
                              aria-label={t('tags.deleteTagAction', { defaultValue: 'Delete {{name}}', name: tag.name })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden grid gap-2">
            {filteredTags.map((tag) => (
              <Card key={tag.id || tag.name} className="py-0 overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tag.color || DEFAULT_COLOR }}
                    >
                      {tag.kind === "scope" ? <Layers className="h-4.5 w-4.5 text-white" /> : <TagIcon className="h-4.5 w-4.5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{tag.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {tag.kind === "scope" ? t('tags.kindLabels.scope') : t('tags.kindLabels.tagWithUsage', { count: tag.usage_count })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditTag(tag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {tag.kind === "tag" && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRename(tag)}>
                          <Merge className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setTagToDelete(tag); setShowDeleteModal(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('tags.deleteConfirmTitle')}</DialogTitle>
              </DialogHeader>

              {tagToDelete && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {tagToDelete.kind === "scope"
                      ? t('tags.deleteConfirmMessageScope', { name: tagToDelete.name })
                      : t('tags.deleteConfirmMessage', { name: tagToDelete.name, count: tagToDelete.usage_count })}
                  </p>

                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tagToDelete.color || DEFAULT_COLOR }}
                    >
                      {tagToDelete.kind === "scope" ? <Layers className="h-6 w-6 text-white" /> : <TagIcon className="h-6 w-6 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm">{tagToDelete.name}</h3>
                      {tagToDelete.kind === "tag" && (
                        <p className="text-xs text-muted-foreground">
                          {t('tags.kindLabels.tagWithUsage', { count: tagToDelete.usage_count })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setTagToDelete(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteTag}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Add/Edit Tag Modal - Always available */}
      <AddTagModal
        open={showTagModal}
        onOpenChange={handleTagModalClose}
        onTagCreated={handleCreateTag}
        editingTag={editingTag}
        onTagUpdated={handleUpdateTag}
      />

      {/* Rename/Merge Modal - Always available */}
      <MergeTagsModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        initialSources={mergeInitialSources}
        initialTarget={mergeInitialTarget}
        onSubmit={handleMergeSubmit}
      />
    </div>
  );
}

export default Tags;
