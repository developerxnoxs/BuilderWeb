import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export function useBuildWebSocket(buildId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!buildId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?buildId=${buildId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected for build:", buildId);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'build_update' && message.projectId) {
          queryClient.invalidateQueries({ 
            queryKey: ["/api/projects", message.projectId, "current-build"] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["/api/builds"] 
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/projects"]
          });
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected for build:", buildId);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [buildId]);

  return wsRef.current;
}
