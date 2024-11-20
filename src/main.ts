import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Constants
const oakesClassroom = leaflet.latLng(36.98949379578401, -122.06277128548504); // Player's starting position
const tileDegrees = 1e-4; // Latitude/longitude distance for each grid cell
const neighborhoodSize = 8; // Grid size around player for cache spawn
const cacheSpawnProbability = 0.1; // Probability for spawning a cache per cell
const gameplayZoomLevel = 19; // Fixed zoom level for gameplay

// Player Data
let playerCoins = 0; // Tracks player's coin count
let playerPosition = oakesClassroom;
const cacheStates = new Map(); // Stores cache state by cell coordinates
const movementHistory: leaflet.LatLng[] = []; // Stores player movement history

// Initialize Map
const map = leaflet.map(document.getElementById("map")!, {
  center: oakesClassroom,
  zoom: gameplayZoomLevel,
  minZoom: gameplayZoomLevel,
  maxZoom: gameplayZoomLevel,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add Player Marker
const playerMarker = leaflet.marker(oakesClassroom).addTo(map);
playerMarker.bindTooltip("That's you!"); // Tooltip for player marker

// UI Update Functions
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
function updatePlayerCoinDisplay() {
  // Updates the display of player's current coin count
  statusPanel.textContent = `Player Coins: ${playerCoins}`;
}

// Flyweight Pattern for Cells
class Cell {
  private static cellCache: Map<string, Cell> = new Map(); // Cache for flyweight pattern

  private constructor(public i: number, public j: number) {}

  static fromLatLng(lat: number, lng: number): Cell {
    const i = Math.round((lat - oakesClassroom.lat) / tileDegrees);
    const j = Math.round((lng - oakesClassroom.lng) / tileDegrees);
    const key = `${i}:${j}`;

    if (!Cell.cellCache.has(key)) {
      Cell.cellCache.set(key, new Cell(i, j));
    }
    return Cell.cellCache.get(key)!;
  }

  static fromCoordinates(i: number, j: number): Cell {
    const key = `${i}:${j}`;
    if (!Cell.cellCache.has(key)) {
      Cell.cellCache.set(key, new Cell(i, j));
    }
    return Cell.cellCache.get(key)!;
  }

  toLatLngBounds(): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [
        oakesClassroom.lat + this.i * tileDegrees,
        oakesClassroom.lng + this.j * tileDegrees,
      ],
      [
        oakesClassroom.lat + (this.i + 1) * tileDegrees,
        oakesClassroom.lng + (this.j + 1) * tileDegrees,
      ],
    ]);
  }

  toLatLng(): leaflet.LatLng {
    return leaflet.latLng(
      oakesClassroom.lat + this.i * tileDegrees,
      oakesClassroom.lng + this.j * tileDegrees,
    );
  }
}

// Cache Representation
interface Cache {
  coins: Coin[];
}

class Coin {
  constructor(public cell: Cell, public serial: number) {}

  get identifier(): string {
    return `${this.cell.i}:${this.cell.j}#${this.serial}`;
  }
}

function spawnCache(cell: Cell) {
  // Creates a cache at the given grid cell with random coin value
  const bounds = cell.toLatLngBounds();
  const cacheCoinsCount =
    Math.floor(luck([cell.i, cell.j, "initialValue"].toString()) * 10) + 1; // Randomized coins in cache

  const coins = Array.from(
    { length: cacheCoinsCount },
    (_, index) => new Coin(cell, index),
  );

  const rect = leaflet.rectangle(bounds).addTo(map);
  rect.bindPopup(() => {
    // Popup with collect and deposit actions
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache Location: (${cell.i}, ${cell.j})</div>
      <div>Coins Available: <span id="value">${coins.length}</span></div>
      <button id="collectButton">Collect Coins</button>
      <input type="number" id="depositAmount" placeholder="Amount to Deposit" min="1">
      <button id="depositButton">Deposit Coins</button>
      <div>Coin Identifiers:</div>
      <ul id="coinList">
        ${
      coins.map((coin) =>
        `<li><a href="#" class="coin-link" data-cell="${coin.cell.i},${coin.cell.j}">${coin.identifier}</a></li>`
      ).join("")
    }
      </ul>`;

    // Collect coins from cache
    popupDiv.querySelector<HTMLButtonElement>("#collectButton")!
      .addEventListener("click", () => {
        if (coins.length > 0) {
          playerCoins += coins.length; // Add cache coins to player's total
          coins.length = 0; // Cache is now empty
          updatePlayerCoinDisplay();
          popupDiv.querySelector<HTMLSpanElement>("#value")!.textContent = "0";
          alert("Collected successfully!");
        } else {
          alert("No coins left.");
        }
      });

    // Deposit coins into cache
    popupDiv.querySelector<HTMLButtonElement>("#depositButton")!
      .addEventListener("click", () => {
        const depositInput = popupDiv.querySelector<HTMLInputElement>(
          "#depositAmount",
        )!;
        const depositAmount = parseInt(depositInput.value || "0");

        if (playerCoins >= depositAmount && depositAmount > 0) {
          playerCoins -= depositAmount; // Subtract deposited coins from player
          coins.push(
            ...Array.from(
              { length: depositAmount },
              (_, index) => new Coin(cell, coins.length + index),
            ),
          );
          updatePlayerCoinDisplay();
          popupDiv.querySelector<HTMLSpanElement>("#value")!.textContent = coins
            .length.toString();
          alert(`Deposited ${depositAmount} coins successfully!`);
          depositInput.value = ""; // Clear input field
        } else {
          alert("Insufficient coins or invalid amount.");
        }
      });

    // Clickable coin identifiers to center map on cache
    popupDiv.querySelectorAll<HTMLAnchorElement>(".coin-link").forEach(
      (link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          const [i, j] = link.dataset.cell!.split(",").map(Number);
          const targetCell = Cell.fromCoordinates(i, j);
          map.setView(targetCell.toLatLng(), gameplayZoomLevel);
        });
      },
    );

    return popupDiv;
  });
}

// Cache Generation
function initializeCaches() {
  // Spawns caches in neighborhood grid around the player's start location
  for (let i = -neighborhoodSize; i <= neighborhoodSize; i++) {
    for (let j = -neighborhoodSize; j <= neighborhoodSize; j++) {
      if (luck(`${i},${j}`) < cacheSpawnProbability) {
        const cell = Cell.fromCoordinates(i, j);
        spawnCache(cell); // Spawn cache based on probability
      }
    }
  }
}

// Constants for Player Movement
const directions = {
  north: { lat: tileDegrees, lng: 0 },
  south: { lat: -tileDegrees, lng: 0 },
  east: { lat: 0, lng: tileDegrees },
  west: { lat: 0, lng: -tileDegrees },
};

// Player Movement
function movePlayer(direction: { lat: number; lng: number }) {
  // Update player's position based on direction
  playerPosition = leaflet.latLng(
    playerPosition.lat + direction.lat,
    playerPosition.lng + direction.lng,
  );

  playerMarker.setLatLng(playerPosition); // Move player marker
  map.setView(playerPosition); // Center map on player's new position

  const newCell = Cell.fromLatLng(playerPosition.lat, playerPosition.lng);
  regenerateCaches(newCell); // Regenerate caches in new neighborhood

  movementHistory.push(playerPosition); // Record player movement
  updatePolyline(); // Update movement history polyline

  // Dispatch player movement event
  const playerMovedEvent = new CustomEvent("player-moved", {
    detail: { position: playerPosition },
  });
  document.dispatchEvent(playerMovedEvent);
}

// Update Movement History Polyline
const movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
  .addTo(map);
function updatePolyline() {
  movementPolyline.setLatLngs(movementHistory);
}

// Attach Event Listeners to Movement Buttons
document.getElementById("north")?.addEventListener(
  "click",
  () => movePlayer(directions.north),
);
document.getElementById("south")?.addEventListener(
  "click",
  () => movePlayer(directions.south),
);
document.getElementById("east")?.addEventListener(
  "click",
  () => movePlayer(directions.east),
);
document.getElementById("west")?.addEventListener(
  "click",
  () => movePlayer(directions.west),
);

document.getElementById("globeButton")?.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
      const { latitude, longitude } = position.coords;
      playerPosition = leaflet.latLng(latitude, longitude);
      playerMarker.setLatLng(playerPosition);
      map.setView(playerPosition);
      movementHistory.push(playerPosition);
      updatePolyline();
      const playerMovedEvent = new CustomEvent("player-moved", {
        detail: { position: playerPosition },
      });
      document.dispatchEvent(playerMovedEvent);
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
});

// Memento Pattern to Save and Restore Cache State
class CacheMemento {
  constructor(public coins: Coin[]) {}
}

function saveCacheState(cell: Cell) {
  const cache = cacheStates.get(cell);
  if (cache) {
    cacheStates.set(cell, new CacheMemento([...cache.coins]));
  }
}

function restoreCacheState(cell: Cell): Cache | null {
  if (cacheStates.has(cell)) {
    const memento = cacheStates.get(cell);
    return { coins: [...memento.coins] };
  }
  return null;
}

// Cache Regeneration
function regenerateCaches(currentCell: Cell) {
  // Remove all caches currently on the map
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  // Spawn new caches in the neighborhood
  for (let i = -neighborhoodSize; i <= neighborhoodSize; i++) {
    for (let j = -neighborhoodSize; j <= neighborhoodSize; j++) {
      const cell = Cell.fromCoordinates(currentCell.i + i, currentCell.j + j);
      if (!cacheStates.has(cell)) {
        if (luck(`${cell.i},${cell.j}`) < cacheSpawnProbability) {
          spawnCache(cell);
          saveCacheState(cell);
        }
      } else {
        // Restore existing cache state
        const cache = restoreCacheState(cell);
        if (cache) {
          spawnCache(cell);
        }
      }
    }
  }
}

// Reset Game State
document.getElementById("resetButton")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to erase your game state?")) {
    playerCoins = 0;
    playerPosition = oakesClassroom;
    movementHistory.length = 0;
    movementPolyline.setLatLngs(movementHistory);
    updatePlayerCoinDisplay();
    map.setView(playerPosition);
    playerMarker.setLatLng(playerPosition);
    initializeCaches();
  }
});

// Load Game State from Local Storage
function loadGameState() {
  const savedPosition = localStorage.getItem("playerPosition");
  const savedCoins = localStorage.getItem("playerCoins");
  const savedHistory = localStorage.getItem("movementHistory");

  if (savedPosition) {
    const [lat, lng] = savedPosition.split(",").map(Number);
    playerPosition = leaflet.latLng(lat, lng);
    playerMarker.setLatLng(playerPosition);
    map.setView(playerPosition);
  }

  if (savedCoins) {
    playerCoins = parseInt(savedCoins, 10);
    updatePlayerCoinDisplay();
  }

  if (savedHistory) {
    movementHistory.push(
      ...JSON.parse(savedHistory).map(([lat, lng]: [number, number]) =>
        leaflet.latLng(lat, lng)
      ),
    );
    updatePolyline();
  }
}

// Save Game State to Local Storage
function saveGameState() {
  localStorage.setItem(
    "playerPosition",
    `${playerPosition.lat},${playerPosition.lng}`,
  );
  localStorage.setItem("playerCoins", playerCoins.toString());
  localStorage.setItem(
    "movementHistory",
    JSON.stringify(movementHistory.map((pos) => [pos.lat, pos.lng])),
  );
}

globalThis.addEventListener("beforeunload", saveGameState);

// Initial Setup
initializeCaches(); // Generate initial caches
updatePlayerCoinDisplay(); // Update initial coin display
loadGameState(); // Load game state from previous session
