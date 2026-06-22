package main

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)



const GridSize = 128

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}



type Cell struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Color     string `json:"color"`
	UpdatedAt int64  `json:"updatedAt"`
}


type DrawMessage struct {
	Type      string `json:"type"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Color     string `json:"color"`
	UpdatedAt int64  `json:"updatedAt,omitempty"`
}

func (msg *DrawMessage) isValid() bool {
	if msg.Type != "draw" {
		return false
	}

	if msg.X < 0 || msg.X >= GridSize || msg.Y < 0 || msg.Y >= GridSize {
		return false
	}

	if msg.Color == "" {
		return false
	}

	return true
}

type SnapshotMessage struct {
	Type  string `json:"type"`
	Cells []Cell `json:"cells"`
}



type Hub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]bool

	// 固定サイズのグリッドを一次元配列で持つ
	cells [GridSize * GridSize]Cell
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) AddClient(conn *websocket.Conn) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[conn] = true

	cells := make([]Cell, 0)

	for _, cell := range h.cells {
		// Color が空なら未描画セルとして扱う
		if cell.Color == "" {
			continue
		}

		cells = append(cells, cell)
	}

	snapshot := SnapshotMessage{
		Type:  "snapshot",
		Cells: cells,
	}

	return conn.WriteJSON(snapshot)
}

func (h *Hub) RemoveClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.clients, conn)
}

func (h *Hub) ApplyDraw(msg DrawMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now().UnixMilli()

	cell := Cell{
		X:         msg.X,
		Y:         msg.Y,
		Color:     msg.Color,
		UpdatedAt: now,
	}

	h.cells[msg.Y*GridSize+msg.X] = cell

	out := DrawMessage{
		Type:      "draw",
		X:         msg.X,
		Y:         msg.Y,
		Color:     msg.Color,
		UpdatedAt: now,
	}

	for conn := range h.clients {
		err := conn.WriteJSON(out)
		if err != nil {
			log.Println("write error:", err)
			conn.Close()
			delete(h.clients, conn)
		}
	}
}




func main() {
	hub := NewHub()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("upgrade error:", err)
			return
		}

		if err := hub.AddClient(conn); err != nil {
			log.Println("snapshot send error:", err)
			conn.Close()
			return
		}

		log.Println("client connected")

		defer func() {
			hub.RemoveClient(conn)
			conn.Close()
			log.Println("client disconnected")
		}()

		for {
			var msg DrawMessage

			if err := conn.ReadJSON(&msg); err != nil {
				log.Println("read error:", err)
				return
			}

			if !msg.isValid() {
				continue
			}

			hub.ApplyDraw(msg)
		}
	})

	log.Println("server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}