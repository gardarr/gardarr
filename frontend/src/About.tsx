import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ExternalLink, Github, Loader2, Heart, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { versionService } from "@/services/version";
import bannerImage from "@/assets/img/banner.png";

export default function AboutPage() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("v0.0.2"); // fallback version
  const [commit, setCommit] = useState<string>(t("about.meta.unknown"));
  const [date, setDate] = useState<string>(t("about.meta.unknown"));
  const [loadingVersion, setLoadingVersion] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await versionService.getVersion();
        if (response.data) {
          setVersion(`v${response.data.version}`);
          setCommit(response.data.commit || t("about.meta.unknown"));
          setDate(response.data.date || t("about.meta.unknown"));
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
        // Keep fallback values
      } finally {
        setLoadingVersion(false);
      }
    };

    fetchVersion();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Project Logo and Version */}
      <Card className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center">
            <img 
              src={bannerImage} 
              alt={t("about.bannerAlt")} 
              className="max-w-full h-auto"
              loading="eager"
              decoding="async"
            />
          </div>

          <p className="text-sm text-muted-foreground max-w-2xl">
            {t("about.objective")}
          </p>
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
              <span className="text-sm font-medium">{t("about.version")}</span>
              {loadingVersion ? (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-sm font-mono text-primary">...</span>
                </div>
              ) : (
                <span className="text-sm font-mono text-primary">{version}</span>
              )}
            </div>
            
            {!loadingVersion && (
              <div className="flex flex-col sm:flex-row gap-2 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
                  <span className="font-medium">{t("about.meta.commit")}</span>
                  <span className="font-mono">{commit.substring(0, 7)}</span>
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
                  <span className="font-medium">{t("about.meta.buildDate")}</span>
                  <span className="font-mono">{date}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 w-full">
            <h3 className="text-xl font-semibold">{t("about.license.title")}</h3>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
              <span className="text-sm font-mono">GPL-3.0</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("about.license.description")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              className="justify-start bg-[var(--color-github)] text-white hover:bg-[var(--color-github-hover)]"
              asChild
            >
              <a 
                href="https://github.com/jfxdev/gardarr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                {t("about.links.repository")}
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            </Button>

            <div className="inline-flex overflow-hidden rounded-md">
              <Button
                className="justify-start bg-[var(--color-sponsor)] text-white hover:bg-[var(--color-sponsor-hover)] rounded-r-none"
                asChild
              >
                <a
                  href="https://github.com/sponsors/jfxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  {t("about.links.sponsor")}
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </Button>

              <Button
                className="justify-start bg-[var(--color-coffee)] text-black hover:bg-[var(--color-coffee-hover)] rounded-l-none border-l border-black/20"
                asChild
              >
                <a
                  href="https://www.buymeacoffee.com/jfxdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  {t("about.links.buyMeCoffee")}
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </Button>
            </div>

            <Button 
              variant="outline" 
              className="justify-start"
              asChild
            >
              <a 
                href="https://github.com/jfxdev/gardarr/blob/main/DEVELOPMENT.md" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Book className="h-4 w-4" />
                {t("about.links.documentation")}
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            </Button>
          </div>

          <div className="pt-2 space-y-5 w-full">
            <p className="text-sm text-muted-foreground">{t("about.thanks")}</p>
          </div>

        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-sm text-muted-foreground py-4">
        {t("about.footer")}
      </div>
    </div>
  );
}

