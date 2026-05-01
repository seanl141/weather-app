/*
The code below sets up the Express server for the Weather Planner application.
It handles API routes for fetching weather and air pollution data, and provides
a SmartPack feature that gives clothing recommendations based on the forecast.
*/
const express = require("express");
const cors = require("cors");
const axios = require("axios");
/*
The Express app is initialized and configured to use CORS and JSON parsing.
The server listens on port 3000.
*/
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const API_KEY = "23c915a5d83f973e3ad1254b1587b55e"; // OpenWeatherMap API Key

/*
This object maps numeric Air Quality Index (AQI) values to
descriptive categories, as defined in the OpenWeatherMap documentation.
*/
const AQI_CATEGORY = {
    1: "Good",
    2: "Fair",
    3: "Moderate",
    4: "Poor",
    5: "Very Poor",
};

/*
This object provides brief health risk explanations for various air pollutants.
It will be used to generate informative warnings for the user.
*/
const POLLUTANT_HEALTH_INFO = {
    co: "High CO (carbon monoxide) can reduce oxygen delivery to the body, causing fatigue and chest pain.",
    no2: "Elevated NO₂ can irritate lungs and reduce immunity to respiratory infections.",
    o3: "Ozone (O₃) exposure may cause throat irritation and breathing difficulties.",
    so2: "High SO₂ can cause throat irritation, coughing, and aggravate asthma.",
    pm2_5: "Fine particles (PM2.5) can enter lungs and bloodstream, increasing risk of heart and lung disease.",
    pm10: "Coarse particles (PM10) can cause coughing and worsen asthma symptoms.",
};

/*
The code below defines an API route '/api/weather' which fetches:
1. Weather forecast data from OpenWeatherMap.
2. Air pollution data based on the city’s coordinates.
It processes the data to produce an average temperature, rainfall info,
umbrella suggestion, and air quality warnings.
*/
app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (!city) {
        return res.status(400).json({ error: "City parameter is required" });
    }

    try {
        /*
       The server fetches a 5-day forecast from OpenWeatherMap, but only the next
       24 data entries (≈3 days) are processed for simplicity.
       */
        const weatherRes = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
            params: {
                q: city,
                units: "metric",
                appid: API_KEY,
            },
        });

        /*
       The API response contains metadata (city info) and a list of forecast entries.
       */
        const cityData = weatherRes.data.city;
        const forecastList = weatherRes.data.list;
        const next3Days = forecastList.slice(0, 24); // ~3 days (3-hour intervals)

        /*
       Variables for calculating averages and detecting rain conditions.
       */
        let temps = [];
        let rainTotal = 0;
        let umbrellaNeeded = false;
        let summaries = [];
        /*
            The loop below processes each forecast entry and extracts temperature, wind,
            rainfall, and weather icon information.
            */
        next3Days.forEach((entry) => {
            const temp = entry.main.temp;
            const wind = entry.wind.speed;
            const rain = entry.rain ? entry.rain["3h"] || 0 : 0;
            const icon = entry.weather[0].icon;

            temps.push(temp);
            rainTotal += rain;
            if (rain > 0) umbrellaNeeded = true;

            summaries.push({
                date: entry.dt_txt,
                temperature: temp,
                windSpeed: wind,
                rainfall: rain,
                icon,
            });
        });
        /*
           The average temperature is calculated to classify the general conditions
           as Cold, Mild, or Hot.
           */
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

        /*
        The category variable defines the general temperature type, which will be
        shared with the SmartPack feature for consistent advice.
        */
        let category = "Mild";
        if (avgTemp < 8) category = "Cold";
        else if (avgTemp > 24) category = "Hot";

        /*
       The packingAdvice variable builds a short text summary based on temperature
       and rain conditions. This will be shown to the user on the frontend.
       */
        let packingAdvice = "";
        if (category === "Cold") packingAdvice = "It's going to be a cold one.\n";
        else if (category === "Mild") packingAdvice = "Don't worry, the weather will be mild.\n";
        else packingAdvice = "It's going to be hot! Stay cool.\n";

        if (umbrellaNeeded) packingAdvice += "Bring an umbrella, they're giving rain!\n";

        /*
        Air pollution data is fetched using the same coordinates returned
        in the weather API response.
        */
        const { lat, lon } = cityData.coord;
        const airRes = await axios.get("https://api.openweathermap.org/data/2.5/air_pollution", {
            params: { lat, lon, appid: API_KEY },
        });

        /*
       The air quality data is parsed to extract the AQI index, pollutant levels,
       and generate health warnings if necessary.
       */
        const airData = airRes.data.list[0];
        const aqi = airData.main.aqi;
        const airCategory = AQI_CATEGORY[aqi];
        const pollutants = airData.components;


        let pollutionWarning = "";
        if (aqi > 1) {
            pollutionWarning += `⚠️ Air Quality is "${airCategory}". `;
            pollutionWarning += "Detected elevated pollutants:\n";
            for (const [key, value] of Object.entries(pollutants)) {
                if (value > 50) {
                    pollutionWarning += `- ${key.toUpperCase()}: ${value} μg/m³ — ${POLLUTANT_HEALTH_INFO[key] || ""
                        }\n`;
                }
            }
        }

        /*
       The summary object is the structured response sent to the frontend.
       It contains weather, air quality, and recommendation data.
       */
        const summary = {
            city: cityData.name,
            country: cityData.country,
            coordinates: { lat, lon },
            category, // temperature category (Cold / Mild / Hot)
            packingAdvice,
            umbrellaNeeded,
            avgTemp: avgTemp.toFixed(1),
            summaries,
            airQuality: {
                index: aqi,
                category: airCategory,
                pollutants,
                warning: pollutionWarning || "Air quality is good",
            },
        };

        res.json(summary);
    } catch (error) {
        console.error("❌ Error fetching weather or air data:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch weather or air pollution data" });
    }
});

/*
The code below defines the '/api/smartpack' route.
It compares the user's wardrobe items with the expected weather conditions
to suggest what to pack and identify any missing clothing types.
*/
app.post("/api/smartpack", (req, res) => {
    const { wardrobe, weather } = req.body;
    if (!wardrobe || !weather) {
        return res.status(400).json({ error: "Wardrobe and weather data are required." });
    }
    /*
     Variables extracted from the request body. The 'category' value comes from the
     weather route to ensure consistency between forecast and SmartPack logic.
     */
    const umbrellaNeeded = weather.umbrellaNeeded;
    const category = weather.category || "Mild"; // use shared category
    const packingAdvice = weather.packingAdvice || "";
    /*
      A base recommendation message is built, starting with the general packing advice.
      */
    let recommendation = packingAdvice + "\n\nPacking recommendations:\n";
    /*
      The neededTypes set stores the weather conditions to check against the wardrobe.
      */
    const neededTypes = new Set([category, "All Weather"]);
    if (umbrellaNeeded) neededTypes.add("Rainy");
    /*
    Wardrobe items are filtered to find which match the needed conditions.
    */
    const itemsToBring = wardrobe.filter((item) => neededTypes.has(item.type));
    const missingTypes = [...neededTypes].filter(
        (type) => !wardrobe.some((item) => item.type === type)
    );
    /*
     The response text lists matching and missing clothing types.
     */
    if (itemsToBring.length > 0) {
        recommendation += "You should bring:\n";
        itemsToBring.forEach((item) => {
            recommendation += `- ${item.name} (${item.type})\n`;
        });
    }

    if (missingTypes.length > 0) {
        recommendation += "\n⚠️ You don’t have clothes for:\n";
        missingTypes.forEach((type) => {
            recommendation += `- ${type} weather\n`;
        });
        recommendation += "Consider packing or buying suitable clothes!\n";
    }

    res.json({ recommendation });
});
/*
The server listens on port 3000 and prints a message
to confirm that it is running successfully.
*/
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
