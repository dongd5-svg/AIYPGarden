// ================================================================
// WEATHER.JS — auto-detect location, Open-Meteo API (free, no key)
// Shows on home page, toggleable per garden in settings
// ================================================================

let weatherInitialized = false;
let weatherCoords      = null; // { lat, lon }

// Open-Meteo is completely free with no API key required
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEO_BASE     = 'https://geocoding-api.open-meteo.com/v1/search';

// WMO weather code descriptions + emoji
const WMO_CODES = {
  0:  { desc: 'Clear sky',          emoji: '☀️' },
  1:  { desc: 'Mainly clear',       emoji: '🌤' },
  2:  { desc: 'Partly cloudy',      emoji: '⛅' },
  3:  { desc: 'Overcast',           emoji: '☁️' },
  45: { desc: 'Fog',                emoji: '🌫' },
  48: { desc: 'Icy fog',            emoji: '🌫' },
  51: { desc: 'Light drizzle',      emoji: '🌦' },
  53: { desc: 'Drizzle',            emoji: '🌦' },
  55: { desc: 'Heavy drizzle',      emoji: '🌧' },
  61: { desc: 'Light rain',         emoji: '🌧' },
  63: { desc: 'Rain',               emoji: '🌧' },
  65: { desc: 'Heavy rain',         emoji: '🌧' },
  66: { desc: 'Freezing rain',      emoji: '🌨' },
  67: { desc: 'Heavy freezing rain',emoji: '🌨' },
  71: { desc: 'Light snow',         emoji: '🌨' },
  73: { desc: 'Snow',               emoji: '❄️' },
  75: { desc: 'Heavy snow',         emoji: '❄️' },
  77: { desc: 'Snow grains',        emoji: '❄️' },
  80: { desc: 'Light showers',      emoji: '🌦' },
  81: { desc: 'Showers',            emoji: '🌧' },
  82: { desc: 'Violent showers',    emoji: '⛈' },
  85: { desc: 'Snow showers',       emoji: '🌨' },
  86: { desc: 'Heavy snow showers', emoji: '🌨' },
  95: { desc: 'Thunderstorm',       emoji: '⛈' },
  96: { desc: 'Thunderstorm + hail',emoji: '⛈' },
  99: { desc: 'Thunderstorm + hail',emoji: '⛈' },
};

function getWMO(code) {
  return WMO_CODES[code] || { desc: 'Unknown', emoji: '🌡' };
}

// ── Init (called once after login) ────────────────────────────────
function initWeather() {
  if (weatherInitialized) {
    renderWeatherWidget();
    return;
  }
  if (!navigator.geolocation) {
    showWeatherError('Geolocation not supported');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      weatherCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      weatherInitialized = true;
      fetchAndRenderWeather();
    },
    () => showWeatherError('Location access denied'),
    { timeout: 8000 }
  );
}

// ── Fetch from Open-Meteo ──────────────────────────────────────────
async function fetchAndRenderWeather() {
  if (!weatherCoords) return;
  const { lat, lon } = weatherCoords;

  try {
    const url = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
      `precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,` +
      `weather_code,sunrise,sunset` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph` +
      `&precipitation_unit=inch&timezone=auto&forecast_days=5`;

    const res  = await fetch(url);
    const data = await res.json();

    // Reverse geocode for city name
    let cityName = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const geo = await geoRes.json();
      cityName = geo.address?.city || geo.address?.town || geo.address?.village
        || geo.address?.county || cityName;
    } catch {}

    renderWeatherWidget(data, cityName);
  } catch(e) {
    showWeatherError('Could not load weather');
  }
}

// ── Render widget ─────────────────────────────────────────────────
function renderWeatherWidget(data, cityName) {
  const widget = document.getElementById('weatherWidget');
  if (!widget) return;

  // Check if any current garden has weather disabled
  // (weather toggle is per-garden but widget lives on home page —
  //  we show it by default, hide only if all gardens have it off)
  widget.style.display = 'block';

  if (!data) {
    widget.innerHTML = `
      <div class="weather-main">
        <span class="weather-icon">🌡</span>
        <div>
          <div class="weather-temp">--°F</div>
          <div class="weather-desc">Loading weather…</div>
        </div>
      </div>`;
    return;
  }

  const c      = data.current;
  const daily  = data.daily;
  const wmo    = getWMO(c.weather_code);
  const feelsLike = Math.round(c.apparent_temperature);
  const temp   = Math.round(c.temperature_2m);
  const humid  = c.relative_humidity_2m;
  const wind   = Math.round(c.wind_speed_10m);
  const precip = c.precipitation;

  // Frost warning: if today's min is below 35°F
  const todayMin    = daily?.temperature_2m_min?.[0];
  const frostWarning = todayMin !== undefined && todayMin <= 35;

  // 5-day forecast
  const forecastHtml = (daily?.weather_code || []).slice(1, 5).map((code, i) => {
    const d = getWMO(code);
    const hi = Math.round(daily.temperature_2m_max[i+1]);
    const lo = Math.round(daily.temperature_2m_min[i+1]);
    const day = new Date();
    day.setDate(day.getDate() + i + 1);
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    return `
      <div class="weather-forecast-day">
        <div class="wf-day">${dayName}</div>
        <div class="wf-icon">${d.emoji}</div>
        <div class="wf-hi">${hi}°</div>
        <div class="wf-lo">${lo}°</div>
      </div>
    `;
  }).join('');

  widget.innerHTML = `
    <div class="weather-top">
      <div class="weather-main">
        <span class="weather-icon">${wmo.emoji}</span>
        <div>
          <div class="weather-temp">${temp}°F</div>
          <div class="weather-desc">${wmo.desc}</div>
        </div>
      </div>
      <div class="weather-details">
        <span class="weather-detail">🌡 Feels like ${feelsLike}°F</span>
        <span class="weather-detail">💧 Humidity ${humid}%</span>
        <span class="weather-detail">💨 Wind ${wind} mph</span>
        ${precip > 0 ? `<span class="weather-detail">🌧 ${precip}" today</span>` : ''}
        ${frostWarning ? `<span class="weather-frost">🧊 Frost risk tonight (${Math.round(todayMin)}°F)</span>` : ''}
      </div>
      <div class="weather-location">📍 ${escHtml(cityName)}</div>
    </div>
    <div class="weather-forecast">${forecastHtml}</div>
  `;
}

function showWeatherError(msg) {
  const widget = document.getElementById('weatherWidget');
  if (widget) {
    widget.style.display = 'block';
    widget.innerHTML = `<span style="color:#888;font-size:0.85rem">🌡 ${msg}</span>`;
  }
}
