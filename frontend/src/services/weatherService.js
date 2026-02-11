const API_KEY = process.env.REACT_APP_OPENWEATHER_KEY;

export async function getWeatherByCity(city) {
  if (!API_KEY) throw new Error("Missing OpenWeather API key");

  const url =
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Failed to fetch weather");
  }

  return {
    city: data.name,
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    description: data.weather?.[0]?.description || "",
    icon: data.weather?.[0]?.icon || "",
    windMph: data.wind?.speed ?? null,
  };
}
