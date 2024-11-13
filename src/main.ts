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

// Cache Creation
function spawnCache(i: number, j: number) {
  // Creates a cache at the given grid cell (i, j) with random coin value
  const bounds = leaflet.latLngBounds([
    [
      oakesClassroom.lat + i * tileDegrees,
      oakesClassroom.lng + j * tileDegrees,
    ],
    [
      oakesClassroom.lat + (i + 1) * tileDegrees,
      oakesClassroom.lng + (j + 1) * tileDegrees,
    ],
  ]);

  let cacheCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 10) + 1; // Randomized coins in cache

  const rect = leaflet.rectangle(bounds).addTo(map);
  rect.bindPopup(() => {
    // Popup with collect and deposit actions
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache Location: (${i}, ${j})</div>
      <div>Coins Available: <span id="value">${cacheCoins}</span></div>
      <button id="collectButton">Collect Coins</button>
      <input type="number" id="depositAmount" placeholder="Amount to Deposit" min="1">
      <button id="depositButton">Deposit Coins</button>`;

    // Collect coins from cache
    popupDiv.querySelector<HTMLButtonElement>("#collectButton")!
      .addEventListener("click", () => {
        if (cacheCoins > 0) {
          playerCoins += cacheCoins; // Add cache coins to player's total
          cacheCoins = 0; // Cache is now empty
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
          cacheCoins += depositAmount; // Add deposited coins to cache
          updatePlayerCoinDisplay();
          popupDiv.querySelector<HTMLSpanElement>("#value")!.textContent =
            cacheCoins.toString();
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
        spawnCache(i, j); // Spawn cache based on probability
      }
    }
  }
}

// Initial Setup
initializeCaches(); // Generate initial caches
updatePlayerCoinDisplay(); // Update initial coin display
