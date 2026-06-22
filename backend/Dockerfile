FROM golang:1.26.4-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/backend main.go


FROM alpine:3.22

WORKDIR /app

COPY --from=build /bin/backend /usr/local/bin/backend

EXPOSE 8080

CMD ["backend"]
