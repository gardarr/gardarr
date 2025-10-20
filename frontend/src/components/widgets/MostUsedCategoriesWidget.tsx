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

export default function MostUsedCategoriesWidget() {
  // Mock data for most used categories
  const mockCategories: CategoryData[] = [
    {
      id: "1",
      name: "Software",
      count: 156,
    },
    {
      id: "2", 
      name: "Movies",
      count: 89,
    },
    {
      id: "3",
      name: "TV Shows",
      count: 67,
    }
  ];

  // Mock data for most used tags
  const mockTags: TagData[] = [
    {
      id: "1",
      name: "linux",
      count: 45,
    },
    {
      id: "2",
      name: "windows",
      count: 38,
    },
    {
      id: "3",
      name: "macos",
      count: 29,
    }
  ];

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
                {mockCategories.map((category, index) => (
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
                ))}
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
                {mockTags.map((tag, index) => (
                  <div key={tag.id} className={`flex items-center justify-between p-1.5 rounded transition-colors ${getHighlightClass(index)}`}>
                    <div className="flex-1 min-w-0 mr-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-medium truncate block cursor-help">
                            #{tag.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>#{tag.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-sm text-muted-foreground flex-shrink-0">
                      {tag.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
