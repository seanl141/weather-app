/*
The code below creates a Vue.js reactive application for the "Popular Destinations" page.
It displays a grid of pre-defined cities with images, allowing the user to click a city
to view its weather and air quality information.
*/

const { createApp } = Vue;

/*
A new Vue app is created to manage city selection, weather data retrieval,
and dynamic updates on the destinations page.
*/
createApp({
    data() {
        return {
            /*
            The cities array contains popular travel destinations.
            Each city object includes a name (used for API requests)
            and an image path (used for display in the grid).
            */
            cities: [
                { name: "London", image: "assets/london.jpg" },
                { name: "Madrid", image: "assets/madrid.jpg" },
                { name: "Paris", image: "assets/paris.jpg" },
                { name: "Prague", image: "assets/prague.jpg" },
                { name: "New York", image: "assets/newyork.jpg" },
                { name: "Reykjavik", image: "assets/reykjavik.jpg" },
                { name: "Tokyo", image: "assets/tokyo.jpg" },
                { name: "Sydney", image: "assets/sydney.jpg" },
            ],

            weather: null, // stores selected city’s weather and air data
            error: "",     // error message for failed API calls
        };
    },

    methods: {
        /*
        The getCityWeather() method is triggered when the user clicks on a city card.
        It calls the backend API (/api/weather) using the city name as a query parameter,
        retrieves the forecast and air quality data, and updates the page view.
        */
        async getCityWeather(city) {
            this.error = "";
            this.weather = null;
            try {
                /*
                The fetch() function requests weather data for the selected city
                from the Express server. The server then retrieves the data from
                OpenWeatherMap and returns a structured summary.
                */
                const res = await fetch(`http://localhost:3000/api/weather?city=${city}`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                /*
                The response data is stored in the Vue state to display the
                weather and air quality information dynamically.
                */
                this.weather = data;
            } catch (err) {
                /*
                If the request fails (e.g., invalid city name or network issue),
                an error message is displayed to the user.
                */
                this.error = "Failed to load city weather data.";
            }
        },

        /*
        The backToList() method resets the view to the main city grid.
        It clears the currently displayed weather data.
        */
        backToList() {
            this.weather = null;
        },
    },
}).mount("#app");

