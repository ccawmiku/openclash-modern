set -eu
mkdir -p /tmp/mihomo-lab
cat >/tmp/mihomo-lab/fixture.rb <<'RUBY'
require 'socket'
server=TCPServer.new('127.0.0.1',17891)
slots=Queue.new;4.times{slots << true}
loop do
 slots.pop;client=server.accept
 Thread.new(client) do |c|
  remote=nil
  begin
   header='';while header.bytesize<8192&&!header.include?("\r\n\r\n");header << c.readpartial(512);end
   match=header.match(/\ACONNECT ([a-zA-Z0-9.-]+):(\d+) HTTP\/1\.[01]\r\n/)
   raise 'invalid fixture request' unless match
   remote=Socket.tcp(match[1],match[2].to_i,connect_timeout:3)
   c.write("HTTP/1.1 200 Connection established\r\n\r\n")
   loop do
    ready=IO.select([c,remote],nil,nil,10);break unless ready
    ready[0].each{|s| data=s.readpartial(4096);(s==c ? remote : c).write(data)}
   end
  rescue StandardError
  ensure
   c.close rescue nil;remote.close rescue nil;slots << true
  end
 end
end
RUBY
cat >/etc/init.d/rp-node-fixture <<'SH'
#!/bin/sh /etc/rc.common
USE_PROCD=1
start_service() {
 procd_open_instance
 procd_set_param command /usr/bin/ruby /tmp/mihomo-lab/fixture.rb
 procd_set_param nice 15
 procd_set_param respawn 3600 5 5
 procd_set_param limits core="0" nofile="64"
 procd_close_instance
}
SH
chmod 755 /etc/init.d/rp-node-fixture
/etc/init.d/rp-node-fixture restart
uci set router_node_health.main.enabled=1
uci set router_node_health.main.interval=30
uci commit router_node_health
/etc/init.d/router-node-health enable
/etc/init.d/router-node-health restart
