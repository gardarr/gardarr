import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tag, Hash } from "lucide-react";

interface CategoryData {
  id: string;
  name: string;
  count: number;
}

interface TagData {
  id: string;
  name: string;
  count: number;
}

interface MostUsedCategoriesWidgetProps {
  categoryUsage?: Record<string, number>;
  tagsUsage?: Record<string, number>;
}

export default function MostUsedCategoriesWidget({ 
  categoryUsage = {}, 
  tagsUsage = {} 
}: MostUsedCategoriesWidgetProps) {
  // Convert category usage data to CategoryData format
  const categories: CategoryData[] = Object.entries(categoryUsage)
    .map(([name, count], index) => ({
      id: `category-${index}`,
      name: name, // Keep original case
      count: count
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 3); // Limit to top 3

  // Convert tags usage data to TagData format
  const tags: TagData[] = Object.entries(tagsUsage)
    .map(([name, count], index) => ({
      id: `tag-${index}`,
      name: name,
      count: count
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 3); // Limit to top 3

  const getHighlightClass = (index: number) => {
    switch (index) {
      case 0:
        return "bg-primary/3 hover:bg-primary/15";
      case 1:
        return "bg-primary/2 hover:bg-primary/10";
      case 2:
        return "bg-primary/1 hover:bg-primary/8";
      default:
        return "hover:bg-accent/50";
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Most Used Categories & Tags
          </CardTitle>
          <Tag className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Categories Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Categories
                </span>
              </div>
              <div className="space-y-1">
                {categories.length > 0 ? (
                  categories.map((category, index) => (
                    <div key={category.id} className={`flex items-center justify-between p-1.5 rounded transition-colors ${getHighlightClass(index)}`}>
                      <div className="flex-1 min-w-0 mr-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium truncate block cursor-help">
                              {category.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{category.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {category.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tags
                </span>
              </div>
              <div className="space-y-1">
                {tags.length > 0 ? (
                  tags.map((tag, index) => (
                    <div key={tag.id} className={`flex items-center justify-between p-1.5 rounded transition-colors ${getHighlightClass(index)}`}>
                      <div className="flex-1 min-w-0 mr-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium truncate block cursor-help">
                              {tag.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{tag.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {tag.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    No tag data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
