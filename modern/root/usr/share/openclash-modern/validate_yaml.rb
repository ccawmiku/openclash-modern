# Parse syntax only; never instantiate YAML objects or execute tags.
require 'psych'
begin
  stream = Psych.parse_stream(STDIN.read)
  visit = lambda do |node|
    if node.is_a?(Psych::Nodes::Mapping)
      seen = {}
      node.children.each_slice(2) do |key, _value|
        if key.is_a?(Psych::Nodes::Scalar)
          raise 'duplicate key' if seen[key.value]
          seen[key.value] = true
        end
      end
    end
    (node.respond_to?(:children) && node.children || []).each { |child| visit.call(child) }
  end
  visit.call(stream)
rescue Psych::SyntaxError, RuntimeError
  exit 1
end
