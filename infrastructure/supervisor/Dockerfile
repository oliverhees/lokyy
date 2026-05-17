FROM oven/bun:1-slim

WORKDIR /app
COPY index.ts ./

# No dependencies — pure Bun stdlib. Just run it.
CMD ["bun", "run", "index.ts"]
