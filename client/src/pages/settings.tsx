import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Server, Save, Key, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Settings() {
  const { toast } = useToast();
  const [serverUrl, setServerUrl] = useState(localStorage.getItem("server_url") || "");
  const [apiKey, setApiKey] = useState(localStorage.getItem("api_key") || "");

  const handleSave = () => {
    localStorage.setItem("server_url", serverUrl);
    localStorage.setItem("api_key", apiKey);
    toast({
      title: "Settings saved",
      description: "Your configuration has been updated successfully.",
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your Android Studio Web environment
          </p>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the IDE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Build Server Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Build Server
            </CardTitle>
            <CardDescription>
              Configure your Debian server for Android builds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                placeholder="https://your-debian-server.com"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                data-testid="input-server-url"
              />
              <p className="text-xs text-muted-foreground">
                The URL of your Debian server with GPU for building Android apps
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="api-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-api-key"
              />
              <p className="text-xs text-muted-foreground">
                Authentication key for secure communication with your build server
              </p>
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} data-testid="button-save-settings">
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Android Studio Web - Version 1.0.0</p>
            <p>Build real Android applications with React Native, Flutter, and Capacitor</p>
            <p className="pt-2">Powered by Monaco Editor, Replit, and your Debian GPU server</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
