# Caravo MCP

Local stdio MCP server for [Caravo](https://caravo.ai) with built-in x402 wallet. Lets AI agents discover, execute, and review marketplace tools via the Model Context Protocol.

## Install

```bash
# Claude Code
claude mcp add caravo -- npx -y @caravo/mcp@latest

# Optional: with API key for balance auth (favorites work either way)
claude mcp add caravo -e CARAVO_API_KEY=am_xxx -- npx -y @caravo/mcp@latest
```

## How It Works

- On first run, checks for an existing wallet from other x402 services and reuses it
- If no wallet found, generates a new one at `~/.caravo/wallet.json`
- If `CARAVO_API_KEY` is set, uses API key balance for payments and loads favorited tools as direct MCP tools
- If no API key, uses x402 USDC payments automatically — just fund the wallet with USDC on Base

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_tools` | Search tools by query, tag, or provider |
| `get_tool_info` | Get tool details, input schema, pricing, reviews |
| `use_tool` | Execute any tool (handles payment automatically) |
| `submit_review` | Submit or upvote a review (requires `execution_id`) |
| `list_tags` | List all categories |
| `list_providers` | List all providers |
| `get_wallet_info` | Get wallet address and USDC balance |
| `favorite_tool` | Bookmark a tool (server with API key, local without) |
| `unfavorite_tool` | Remove bookmark (server with API key, local without) |
| `list_favorites` | List bookmarked tools (server with API key, local without) |
| `list_tool_requests` | Browse tool requests |
| `request_tool` | Request a new tool |
| `upvote_tool_request` | Upvote a tool request |

## Development

```bash
npm install
npm run build
npm run dev    # uses --experimental-strip-types
```

## Ecosystem

- [caravo.ai](https://caravo.ai) — Official website and marketplace
- [Caravo-CLI](https://github.com/Caravo-AI/Caravo-CLI) — Command-line interface (`@caravo/cli`)
- [Agent-Skills](https://github.com/Caravo-AI/Agent-Skills) — Agent skill via Caravo CLI — no MCP required

## License

MIT
