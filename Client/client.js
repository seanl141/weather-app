/*
The code below creates a Vue.js reactive application for the Weather Planner project.
It handles user input, API requests to the backend, and dynamically updates the UI
with weather, air quality, and SmartPack recommendations.
*/

const { createApp } = Vue;

/*
A new Vue app instance is created. It manages data (state), computed properties,
and methods for interaction with the backend server.
*/
createApp({
    data() {
        return {
            city: "",               // user input for the city name
            cityName: "",           // formatted city name returned from API
            packingAdvice: "",      // SmartPack advice displayed to the user
            forecast: [],           // full list of 3-hour forecast data
            summaryData: [],        // aggregated data for 3-day summary table
            airQuality: null,       // air quality info (from server)
            error: "",              // error message for failed requests
            view: "summary",        // toggles between 'summary' and 'daily' view
            selectedDay: "",        // currently selected day for day-by-day table
            wardrobe: [],           // array storing wardrobe items ({ name, type })
            newItem: "",            // name of clothing item being added
            newType: "",            // weather type of clothing item being added
        };
    },

    /*
    Computed properties automatically recalculate when dependent data changes.
    They are used to extract or format data dynamically for display.
    */
    computed: {

        /*
        The code below creates a unique list of days from the forecast data.
        It is used to populate the day selector in the “Day-by-Day” table.
        */
        daysList() {
            const dates = this.forecast.map(f => f.date.split(" ")[0]);
            return [...new Set(dates)];
        },

        /*
        The code below filters and formats detailed weather data for the currently
        selected day. Each row represents a 3-hour forecast entry.
        */
        dailyDetails() {
            return this.forecast
                .filter(f => f.date.startsWith(this.selectedDay))
                .map(f => ({
                    time: f.date.split(" ")[1],
                    temp: f.temperature,
                    wind: f.windSpeed,
                    rain: f.rainfall,
                    icon: f.icon
                }));
        },

        /*
        The code below dynamically assigns a CSS banner class based on the average
        temperature of the forecast. This changes the header colour for Cold, Mild, or Hot conditions.
        */
        bannerClass() {
            if (!this.forecast.length) return ''; // no banner colour if no data
            const temps = this.forecast.map(f => f.temperature);
            const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

            if (avg < 8) return 'cold-banner';
            if (avg <= 24) return 'mild-banner';
            return 'hot-banner';
        },
    },

    /*
    The methods section defines actions triggered by user interactions,
    such as adding wardrobe items, fetching weather data, and updating SmartPack advice.
    */
    methods: {

        /*
        The code below adds a new clothing item to the wardrobe list.
        It requires both a name and weather type (Cold, Hot, etc.).
        */
        addItem() {
            if (this.newItem && this.newType) {
                this.wardrobe.push({ name: this.newItem, type: this.newType });
                this.newItem = "";
                this.newType = "";
            }
        },

        /*
        The code below removes a wardrobe item at the specified index.
        */
        removeItem(index) {
            this.wardrobe.splice(index, 1);
        },

        /*
        The getWeather() method is called when the user clicks "Get Forecast".
        It performs the following steps:
          1. Fetches weather data from the server (/api/weather).
          2. Groups the data by day for the summary table.
          3. Sends a POST request to /api/smartpack to get packing recommendations.
        */
        async getWeather() {
            this.error = "";
            this.packingAdvice = "";
            this.forecast = [];
            this.summaryData = [];
            this.airQuality = null;

            try {
                /*
                The code below sends a GET request to the server,
                including the user’s chosen city as a query parameter.
                */
                const res = await fetch(`http://localhost:3000/api/weather?city=${this.city}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                /*
                The city name, country, forecast, and air quality data
                are stored in the Vue state for reactive updates.
                */
                this.cityName = `${data.city}, ${data.country}`;
                this.forecast = data.summaries;
                this.airQuality = data.airQuality;

                /*
                The code below groups the 3-hour forecast data by date.
                It calculates average temperature, wind speed, and total rain
                for each of the next three days.
                */
                const grouped = {};
                data.summaries.forEach(f => {
                    const date = f.date.split(" ")[0];
                    if (!grouped[date]) grouped[date] = { temps: [], winds: [], rains: [] };
                    grouped[date].temps.push(f.temperature);
                    grouped[date].winds.push(f.windSpeed);
                    grouped[date].rains.push(f.rainfall);
                });

                /*
                The grouped data is converted into an array of daily summary objects
                to populate the 3-day summary table.
                */
                this.summaryData = Object.keys(grouped)
                    .slice(0, 3)
                    .map(date => ({
                        date,
                        temp: grouped[date].temps.reduce((a, b) => a + b, 0) / grouped[date].temps.length,
                        wind: grouped[date].winds.reduce((a, b) => a + b, 0) / grouped[date].winds.length,
                        rain: grouped[date].rains.reduce((a, b) => a + b, 0),
                        icon: this.forecast.find(f => f.date.startsWith(date))?.icon
                    }));

                /*
                Automatically sets the selected day for the “Day-by-Day” table
                to the first day in the forecast.
                */
                this.selectedDay = this.daysList[0];

                /*
                The code below sends a POST request to the SmartPack API endpoint.
                It passes the full wardrobe and the current weather data so that the
                backend can generate personalized clothing advice.
                */
                const smartRes = await fetch("http://localhost:3000/api/smartpack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        wardrobe: this.wardrobe,
                        weather: data,
                    }),
                });

                /*
                The SmartPack recommendation text returned from the server is stored
                in packingAdvice and displayed in the UI.
                */
                const smartData = await smartRes.json();
                this.packingAdvice = smartData.recommendation;

            } catch (err) {
                /*
                If an error occurs (e.g. invalid city or network issue),
                an error message is displayed to the user.
                */
                this.error = "Could not fetch weather data.";
            }
        },
    },
}).mount("#app");


