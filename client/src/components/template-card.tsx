import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCode, Download } from "lucide-react";
import { Template } from "@shared/schema";

interface TemplateCardProps {
  template: Template;
  onUseTemplate: (template: Template) => void;
}

const frameworkColors = {
  "react-native": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "flutter": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "capacitor": "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export function TemplateCard({ template, onUseTemplate }: TemplateCardProps) {
  return (
    <Card className="hover-elevate transition-all duration-200" data-testid={`card-template-${template.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
            <FileCode className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{template.name}</CardTitle>
            <CardDescription className="text-xs truncate mt-1 line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex flex-col gap-3 pt-4">
        <div className="w-full">
          <Badge 
            variant="outline" 
            className={frameworkColors[template.framework as keyof typeof frameworkColors]}
            data-testid={`badge-template-framework-${template.id}`}
          >
            {template.framework}
          </Badge>
        </div>
        <Button 
          className="w-full" 
          onClick={() => onUseTemplate(template)}
          data-testid={`button-use-template-${template.id}`}
        >
          <Download className="mr-2 h-4 w-4" />
          Use Template
        </Button>
      </CardFooter>
    </Card>
  );
}
