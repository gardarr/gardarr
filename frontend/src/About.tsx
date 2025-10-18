import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { ExternalLink, Github, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/img/logo/logo_256x256.png";

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Leaf className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("about.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("about.subtitle")}</p>
        </div>
      </div>

      {/* Project Logo and Version */}
      <Card className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-24 w-24 rounded-2xl overflow-hidden flex items-center justify-center">
            <img 
              src={logoImage} 
              alt="Gardarr Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          
          <div>
            <h2 className="text-4xl font-bold">Gardarr</h2>
            <p className="text-muted-foreground mt-2">
              {t("about.tagline")}
            </p>
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
            <span className="text-sm font-medium">{t("about.version")}</span>
            <span className="text-sm font-mono text-primary">v0.0.2</span>
          </div>
        </div>
      </Card>

      {/* Project Description */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">{t("about.description.title")}</h3>
        <div className="space-y-4 text-muted-foreground">
          <p>{t("about.description.text1")}</p>
          <p>{t("about.description.text2")}</p>
        </div>
      </Card>

      {/* Features */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">{t("about.features.title")}</h3>
        <ul className="space-y-3">
          {[
            "multiPlatform",
            "automated",
            "lightweight",
            "openSource",
            "mobileOptimized"
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Leaf className="h-3 w-3 text-primary" />
              </div>
              <span className="text-muted-foreground">{t(`about.features.${feature}`)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Links */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">{t("about.links.title")}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="justify-start"
            asChild
          >
            <a 
              href="https://github.com/gardarr/gardarr" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              {t("about.links.repository")}
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start"
            asChild
          >
            <a 
              href="https://github.com/gardarr/gardarr/blob/main/DEVELOPMENT.md" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              {t("about.links.documentation")}
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </Button>
        </div>
      </Card>

      {/* Attribution */}
      <Card className="p-6 bg-muted/50">
        <h3 className="text-sm font-semibold mb-3">{t("about.attribution.title")}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t("about.attribution.logo")}</p>
          <a 
            href="https://www.flaticon.com/free-icons/sprout" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Sprout icons created by Freepik - Flaticon
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>

      {/* License */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">{t("about.license.title")}</h3>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
            <span className="text-sm font-mono">GPL-3.0</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("about.license.description")}
          </p>
        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-sm text-muted-foreground py-4">
        {t("about.footer")}
      </div>
    </div>
  );
}

