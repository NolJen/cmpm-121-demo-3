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
      <button id="depositButton">Deposit Coins</button>`;

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

// Initial Setup
initializeCaches(); // Generate initial caches
updatePlayerCoinDisplay(); // Update initial coin display
