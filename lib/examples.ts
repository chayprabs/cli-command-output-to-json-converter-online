import parserManifest from "./parser-manifest.json";

const DEFAULT_PLACEHOLDER = `Paste raw command output here.

Choose a format above — the placeholder updates with a command hint when available.`;

const PARSER_EXAMPLES: Record<string, string> = {
  ls: `total 48
drwxr-xr-x  6 user user 4096 Apr  1 10:00 .
drwxr-xr-x 20 user user 4096 Apr  1 09:00 ..
-rw-r--r--  1 user user 1234 Apr  1 10:00 README.md
-rwxr-xr-x  1 user user 5678 Apr  1 10:00 script.sh
drwxr-xr-x  2 user user 4096 Apr  1 10:00 src`,
  ps: `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1 225344  9000 ?        Ss   09:00   0:01 /sbin/init
user      1234  0.5  2.3 512000 45000 pts/0    Sl   09:30   0:45 node server.js`,
  ping: `PING google.com (142.250.80.46) 56(84) bytes of data.
64 bytes from lga34s32-in-f14.1e100.net (142.250.80.46): icmp_seq=1 ttl=116 time=12.3 ms
64 bytes from lga34s32-in-f14.1e100.net (142.250.80.46): icmp_seq=2 ttl=116 time=11.8 ms
--- google.com ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1001ms`,
  df: `Filesystem     1K-blocks    Used Available Use% Mounted on
udev             4017528       0   4017528   0% /dev
/dev/sda1      102400000 5120000  92160000   6% /`,
  du: `4       ./src/components
8       ./src
12      ./scripts
48      .`,
  env: `HOME=/home/user
PATH=/usr/local/bin:/usr/bin:/bin
SHELL=/bin/bash
USER=user`,
  dig: `; <<>> DiG 9.16.1-Ubuntu <<>> google.com
;; global options: +cmd
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;google.com.                    IN      A`,
  ifconfig: `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255
        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>
        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)
        RX packets 98301  bytes 129312844 (129.3 MB)`,
  netstat: `Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      2154/node
tcp6       0      0 :::22                   :::*                    LISTEN      1120/sshd`,
  systemctl: `UNIT                         LOAD   ACTIVE SUB     DESCRIPTION
cron.service                 loaded active running Regular background program processing daemon
docker.service               loaded active running Docker Application Container Engine
systemd-journald.service     loaded active running Journal Service`,
  top: `top - 10:16:03 up 5 days,  2:01,  2 users,  load average: 0.22, 0.37, 0.41
Tasks: 204 total,   1 running, 203 sleeping,   0 stopped,   0 zombie
%Cpu(s):  3.1 us,  1.2 sy,  0.0 ni, 95.3 id,  0.1 wa,  0.0 hi,  0.3 si,  0.0 st
MiB Mem :   7820.2 total,    910.4 free,   2794.1 used,   4115.7 buff/cache`,
  ss: `Netid State  Recv-Q Send-Q Local Address:Port   Peer Address:Port Process
tcp   LISTEN 0      511      127.0.0.1:3000      0.0.0.0:*
tcp   ESTAB  0      0        192.168.1.42:51614  104.18.6.218:443`,
  route: `Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         192.168.1.1     0.0.0.0         UG    100    0        0 eth0
192.168.1.0     0.0.0.0         255.255.255.0   U     100    0        0 eth0`,
  yaml: `name: example-service
version: "1.0"
replicas: 3`,
  xml: `<?xml version="1.0"?>
<root><item id="1">alpha</item></root>`,
  csv: `name,role,active
alice,admin,true
bob,viewer,false`,
};

const manifestBySlug = new Map(
  (parserManifest as { slug: string; description: string }[]).map((entry) => [
    entry.slug,
    entry.description,
  ]),
);

function commandHintFromDescription(description: string) {
  const match = description.match(/`([^`]+)`/);
  return match?.[1];
}

export function getParserCommandHint(slug: string) {
  const fromManifest = manifestBySlug.get(slug);
  if (fromManifest) {
    const hint = commandHintFromDescription(fromManifest);
    if (hint) {
      return hint;
    }
  }

  return slug;
}

export function getParserExample(slug: string) {
  if (PARSER_EXAMPLES[slug]) {
    return PARSER_EXAMPLES[slug];
  }

  const hint = getParserCommandHint(slug);
  return `# Paste output from: ${hint}
#
# Run the command in your terminal, copy the raw output, and paste it below.`;
}
