# AI-Powered Dashboard Template

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version 1.0.0"/>
  <img src="https://img.shields.io/badge/next.js-14.0+-black.svg" alt="Next.js 14.0+"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"/>
  <img src="https://img.shields.io/badge/react-18.2+-blue.svg" alt="React 18.2+"/>
</p>

A modern, AI-powered analytics dashboard built with Next.js, Chart.js, and a live Model Context Protocol server. The frontend calls real MCP tools (`get_metrics`, `get_chart_data`, `get_insights`, `drill_down`) through a Next.js API route — every chart and insight is computed by the MCP server, not hardcoded.

## What's Included

- Next.js 14 with Pages Router and an API route
- MCP server (`src/mcpServer.js`) with 6 analytics tools
- Live data wiring: the UI fetches from the MCP server via `/api/dashboard`
- Chart.js integration with react-chartjs-2
- AI insights, predictive forecasts, and anomaly detection
- Responsive grid layout system
- ESLint + Prettier code quality
- Jest + React Testing Library
- Docker multi-stage build with health checks
- CI/CD pipeline via GitHub Actions

## Features

- **Predictive Insights**: 3-month forecasts computed by the MCP server
- **Anomaly Detection**: z-score based anomaly alerts from real tool output
- **Interactive Charts**: Chart.js visualizations fed by `get_chart_data`
- **Responsive Design**: Optimized for desktop and mobile viewports
- **Modern Stack**: Next.js 14, React 18, Chart.js 4, MCP SDK
- **Code Quality**: ESLint + Prettier enforced standards
- **Dockerized**: Multi-stage Dockerfile with HEALTHCHECK
- **CI/CD Ready**: GitHub Actions workflow
- **Performance**: Optimized builds with Next.js static generation

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/amanhammadK/ai-powered-dashboard-template.git
cd ai-powered-dashboard-template

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Testing

```bash
# Run test suite
npm test
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
ai-powered-dashboard-template/
├── pages/
│   ├── index.tsx                # Dashboard UI with charts
│   └── api/
│       └── dashboard.js         # API route that proxies to the MCP server
├── src/
│   ├── index.js                # MCP server entry point
│   ├── mcpServer.js            # MCP server implementation
│   └── schemas.js              # Zod validation schemas
├── __tests__/
│   └── index.test.js           # Dashboard tests
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── .prettierrc                # Prettier configuration
├── Dockerfile                 # Multi-stage Docker build
├── eslint.config.js           # ESLint configuration
├── jest.config.js             # Jest configuration
├── next.config.js             # Next.js configuration
├── package.json               # Project dependencies
└── README.md      
```

## How Data Flows

The dashboard is not hardcoded — it runs a real MCP server and calls its tools live:

1. `npm run dev` starts Next.js.
2. The UI calls `POST /api/dashboard` with a tool name and args.
3. `pages/api/dashboard.js` spawns the MCP server (`node src/index.js`) as a child process and connects over stdio using the MCP SDK client.
4. The MCP server runs the actual tool (`get_metrics`, `get_chart_data`, `get_insights`, `drill_down`, …) and returns real computed values.

Every KPI, chart, and insight on the page comes from a real MCP tool call. The MCP server exposes these tools:

| Tool | Purpose |
|------|---------|
| `get_metrics` | Aggregate a metric (sum/avg/p50/p95…) over a time range |
| `get_chart_data` | Chart-ready labels + series with grouping and filters |
| `get_insights` | Trend, anomaly, summary, and predictive insights |
| `drill_down` | Breakdown of a metric by dimension (region, channel, endpoint) |
| `export_data` | Export as CSV, JSON, or PDF |
| `aggregate_data` | Merge results from API, database, and file sources |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Public URL of the application | No |
| `NEXT_PUBLIC_GA_ID` | Google Analytics tracking ID | No |

### Customizing the Dashboard

The dashboard layout lives in `pages/index.tsx` and uses CSS Grid plus Chart.js. Modify it to:

- Add new KPI cards or insight panels
- Change grid column layout
- Wire charts to your own API data sources
- Customize styling and themes

## Deployment

### Docker

```bash
# Build the image
docker build -t ai-powered-dashboard .

# Run the container
docker run -p 3000:3000 ai-powered-dashboard
```

### Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
```

### Other Platforms

- **Netlify**: Connect repo and set build command to `npm run build`
- **AWS Amplify**: Configure build settings for Next.js
- **Railway**: Deploy via Dockerfile

## Development Guide

### Adding a New Chart

1. Install chart.js components as needed
2. Create a new chart component
3. Add it to the dashboard grid

```javascript
import { Line } from 'react-chartjs-2';

export default function TrendChart({ data }) {
    return <Line data={data} />;
}
```

### Adding AI Insights

```javascript
export default function InsightCard({ title, insight, type }) {
    return (
        <div className={`insight-card ${type}`}>
            <h3>{title}</h3>
            <p>{insight}</p>
        </div>
    );
}
```

### Code Style

- ESLint with Next.js and Prettier configs
- Run `npm run lint` to check
- Run `npm test` before submitting PRs

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Next.js and ❤️
</p>