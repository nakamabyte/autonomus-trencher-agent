FROM node:20-alpine

# Install build tools for sqlite3 (if needed by better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package info and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Set environment to production
ENV NODE_ENV=production
# The app defaults to 4001, but users can override
ENV PORT=4001

# Expose the API port
EXPOSE 4001

# Run the app
CMD ["npm", "run", "start"]
