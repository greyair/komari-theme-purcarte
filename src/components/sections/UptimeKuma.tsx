import { useEffect, useState } from "react";
import { useAppConfig } from "@/config";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/utils";
import { Tooltip } from "@radix-ui/themes";

interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  hostname: string;
  port: number;
  maxretries: number;
  weight: number;
  active: number;
  type: string;
  interval: number;
  keyword: string;
  expiryNotification: boolean;
  ignoreTls: boolean;
  upsideDown: boolean;
  packetSize: number;
  maxredirects: number;
  accepted_statuscodes: string[];
  dns_resolve_server: string;
  dns_resolve_type: string;
  mqttUsername: string;
  mqttTopic: string;
  mqttSuccessMessage: string;
  databaseConnectionString: string;
  databaseQuery: string;
  authMethod: string;
  grpcUrl: string;
  grpcProtobuf: string;
  grpcMethod: string;
  grpcServiceName: string;
  grpcEnableTls: boolean;
  radiusUsername: string;
  radiusCalledStationId: string;
  radiusCallingStationId: string;
  game: string;
  gamedigGivenPortOnly: boolean;
  steamID64: string;
  httpBodyEncoding: string;
  description: string;
  tlsCa: string;
  tlsCert: string;
  tlsKey: string;
  docker_container: string;
  docker_host: number;
  proxyId: number;
  notificationIDList: any;
  tags: any[];
  maintenance: boolean;
  mqttPassword: string;
  authDomain: string;
  authWorkstation: string;
  grpcBody: string;
  grpcMetadata: string;
  radiusPassword: string;
  radiusSecret: string;
  monitor_group_id: number;
}

interface Heartbeat {
  id: number;
  monitor_id: number;
  status: number;
  msg: string;
  time: string;
  ping: number;
  duration: number;
  down_count: number;
  important: number;
}

interface StatusPageData {
  config: any;
  incident: any;
  maintenanceList: any[];
  publicGroupList: {
    id: number;
    name: string;
    weight: number;
    monitorList: Monitor[];
  }[];
}

interface HeartbeatData {
  heartbeatList: {
    [key: string]: Heartbeat[];
  };
  uptimeList: {
    [key: string]: number;
  };
}

export const UptimeKuma = () => {
  const { uptimeKumaApiUrl } = useAppConfig();
  const [statusData, setStatusData] = useState<StatusPageData | null>(null);
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uptimeKumaApiUrl) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const normalizedUrl = uptimeKumaApiUrl.replace(/\/$/, "");
        const statusUrl = normalizedUrl.includes("/api/status-page/")
          ? normalizedUrl
          : `${normalizedUrl}/api/status-page/0`;
        const heartbeatUrl = normalizedUrl.includes("/api/status-page/")
          ? normalizedUrl.replace(
              /\/api\/status-page\/([^/]+)$/,
              "/api/status-page/heartbeat/$1"
            )
          : `${normalizedUrl}/api/status-page/heartbeat/0`;

        if (statusUrl === heartbeatUrl) {
          throw new Error("Invalid Uptime Kuma status page URL");
        }

        const [statusRes, heartbeatRes] = await Promise.all([
          fetch(statusUrl),
          fetch(heartbeatUrl),
        ]);

        if (!statusRes.ok || !heartbeatRes.ok) {
          throw new Error("Failed to fetch Uptime Kuma data");
        }

        const statusJson = await statusRes.json();
        const heartbeatJson = await heartbeatRes.json();

        setStatusData(statusJson);
        setHeartbeatData(heartbeatJson);
        setError(null);
      } catch (err) {
        console.error("Error fetching Uptime Kuma data:", err);
        setError("Failed to load status data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [uptimeKumaApiUrl]);

  if (!uptimeKumaApiUrl || loading || error || !statusData || !heartbeatData) {
    return null;
  }

  const allMonitors = statusData.publicGroupList.flatMap(
    (group) => group.monitorList
  );

  const getStatusColor = (status: number) => {
    switch (status) {
      case 1:
        return "bg-green-500";
      case 0:
        return "bg-red-500";
      case 2:
        return "bg-yellow-500";
      case 3:
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusColorName = (status: number) => {
    switch (status) {
      case 1:
        return "green";
      case 0:
        return "red";
      case 2:
        return "yellow";
      case 3:
        return "gray";
      default:
        return "gray";
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1:
        return "正常";
      case 0:
        return "异常";
      case 2:
        return "检测中";
      case 3:
        return "维护中";
      default:
        return "未知";
    }
  };

  const getStatusCode = (message?: string) => {
    if (!message) return "-";
    const match = message.match(/\b\d{3}\b/);
    return match ? match[0] : message;
  };

  const formatTime = (timeStr: string) => {
    const hasTimeZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(timeStr);
    const normalized = timeStr.includes("T")
      ? timeStr
      : timeStr.replace(" ", "T");
    const date = new Date(hasTimeZone ? normalized : `${normalized}Z`);
    return date.toLocaleString();
  };

  const buildHistorySegments = (heartbeats: Heartbeat[], size = 24) => {
    if (heartbeats.length === 0) {
      return [];
    }
    const sorted = [...heartbeats].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    const chunkSize = Math.ceil(sorted.length / size);
    const startIndex = Math.max(0, sorted.length - chunkSize * size);
    const recent = sorted.slice(startIndex);
    const lastHeartbeat = recent[recent.length - 1];
    return Array.from({ length: size }, (_, index) => {
      const chunk = recent.slice(index * chunkSize, (index + 1) * chunkSize);
      if (chunk.length) {
        return chunk[chunk.length - 1];
      }
      return lastHeartbeat;
    });
  };

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold">网站在线状态</h2>
      </div>
      
      <ScrollArea className="w-full" showHorizontalScrollbar>
        <div className="w-full min-w-full px-2 pb-2">
          <div className="space-y-1">
            <Card className="theme-card-style text-primary font-bold grid grid-cols-12 text-center gap-4 p-2 items-center">
              <div className="col-span-2">名称</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-1">状态码</div>
              <div className="col-span-1">响应时间</div>
              <div className="col-span-2">最后检查</div>
              <div className="col-span-5">24h记录</div>
            </Card>

            {allMonitors.map((monitor) => {
              const heartbeats = heartbeatData.heartbeatList[monitor.id] || [];
              const sortedHeartbeats = [...heartbeats].sort(
                (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
              );
              const lastHeartbeat = sortedHeartbeats[sortedHeartbeats.length - 1];
              const status = lastHeartbeat ? lastHeartbeat.status : 2;
              const historySegments = buildHistorySegments(sortedHeartbeats, 24);

              return (
                <Card key={monitor.id} className="theme-card-style grid grid-cols-12 text-center gap-4 p-2 items-center hover:bg-accent/50 transition-colors">
                  <div className="col-span-2 font-medium text-left pl-4 truncate" title={monitor.name}>
                    {monitor.name}
                  </div>
                  
                  <div className="col-span-1 flex justify-center">
                    <Tag
                      tags={[`${getStatusText(status)}<${getStatusColorName(status)}>`]}
                      className="justify-center"
                    />
                  </div>

                  <div className="col-span-1 text-sm">
                    {getStatusCode(lastHeartbeat?.msg)}
                  </div>

                  <div className="col-span-1 text-sm">
                    {lastHeartbeat?.ping ? `${lastHeartbeat.ping} ms` : "-"}
                  </div>

                  <div className="col-span-2 text-sm text-muted-foreground">
                    {lastHeartbeat?.time ? formatTime(lastHeartbeat.time) : "-"}
                  </div>

                  <div className="col-span-5 flex items-center gap-[2px] h-8 px-2">
                    {historySegments.map((hb, idx) => (
                      <Tooltip
                        key={idx}
                        content={
                          hb ? (
                            <div className="text-xs">
                              <p>{formatTime(hb.time)}</p>
                              <p>{hb.msg}</p>
                              <p>{hb.ping} ms</p>
                            </div>
                          ) : (
                            <div className="text-xs">暂无数据</div>
                          )
                        }
                      >
                        <div
                          className={cn(
                            "flex-1 h-full rounded-sm transition-all hover:scale-110 hover:opacity-80 cursor-help",
                            hb ? getStatusColor(hb.status) : "bg-gray-400"
                          )}
                        />
                      </Tooltip>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
