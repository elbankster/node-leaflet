var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

// Initialize the map
const map = L.map('map', {
    center: [42.98, -81.24],
    zoom: 12,
    layers: [osm] // Add base layer here, other layers will be added later
});

// Create custom panes for layering
map.createPane('userLocationsPane');
map.getPane('userLocationsPane').style.zIndex = 210; // Higher z-index

map.createPane('publicLaunchesPane');
map.getPane('publicLaunchesPane').style.zIndex = 200; // Lower z-index

// Define the layer groups and assign them to the panes
var user_locations = L.layerGroup([], { pane: 'userLocationsPane' });
var public_launches = L.layerGroup([], { pane: 'publicLaunchesPane' });

// Add layers to the map
map.addLayer(public_launches);
map.addLayer(user_locations);
var launchIcon = L.icon({
    iconUrl: 'media/boat_launch.png',
    iconSize: [30, 30], 
    iconAnchor: [15,0], 
});

var putInIcon = L.icon({
    iconUrl: 'media/oars.png',
    iconSize: [30, 30], 
    iconAnchor: [15, 5],
});

// query public launches and place the markers
async function addPublicLaunches() {
    // get window bounds, used to build overpass query string
    const bounds = map.getBounds();

    // build query string
    const query = `
        [out:json];
        node["leisure"="slipway"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});out;
    `;
    
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    
    // get data from url
    fetch(url)
    .then(response => response.json())
    .then(data => {

        // Process the data returned
        data.elements.forEach(element => {
            if (element.type === 'node') {
                // Add marker to the map
                var marker = L.marker([element.lat, element.lon], { icon: launchIcon, pane: 'publicLaunchesPane' });
                
                // If this node has a name identified, add it as a popup
                if (element.tags.name) {
                    marker.bindPopup('<strong>' + element.tags.name + '</strong><br>Lat: ' + element.lat + '<br>Lon: ' + element.lon);
                }
                else {
                    marker.bindPopup('Lat: ' + element.lat + '<br>Lon: ' + element.lon);
                }

                public_launches.addLayer(marker);
            }
        });
    
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://kuuapkkqpvpqekfoicfq.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dWFwa2txcHZwcWVrZm9pY2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUyMzM1MjQsImV4cCI6MjA1MDgwOTUyNH0.pR3vYyDNMVRLlxcY3pWqZleXr65VUSmcB_owfPhfOBo"
const supabase = createClient(supabaseUrl, supabaseKey);

async function addUserLocation(e) {

    const name = prompt("Name this location:");
    if (!name) return;

    const waterway = prompt("Waterway:");
    if (!waterway) return;

    const gauge_id = prompt("Gauge ID:") || null;
    const rec_flow = prompt("Recommended flow:") || null;
    const min_flow = prompt("Minimum flow:") || null;
    const max_flow = prompt("Maximum flow:") || null;
    const latitude = e.latlng.lat;
    const longitude = e.latlng.lng;

    try {
        const { data, error } = await supabase
            .from('user_location')
            .insert([{ 
                name: name,
                waterway: waterway,
                lat: latitude, 
                lon: longitude,
                gauge_id: gauge_id,
                flow_low: min_flow,
                flow_high: max_flow,
                flow_rec: rec_flow
            }]);
            
        if (error) {
            console.error("Error saving location:", error);
            alert("Failed to save the location. Please try again.");
        } else {
            var marker = L.marker(e.latlng, { icon: putInIcon })
                .addTo(user_locations)
                .bindPopup(`${name}<br>${waterway}`)
                .openPopup();
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }        
    
}

async function updateLocationDetails(marker, location) {

    const currentConditions = await getGaugeDetails(location.gauge_id);

    const popupContent = generatePopupContent(location, currentConditions);

    marker.bindPopup(popupContent);
    
    const locationDetails = document.getElementById('location-details');

    // Update the Location Details section
    let detailsHTML = `
        <h2>${location.name}</h2>
        <span>
        <p><strong>Waterway:</strong> ${location.waterway}</p>
    `;

    if (location.flow_rec) {
        detailsHTML += `<p><strong>Recommended Flow:</strong> ${location.flow_rec}</p>`;
    }

    if (location.flow_low && location.flow_high) {
        detailsHTML += `<p><strong>Flow Range:</strong> Min: ${location.flow_low}, Max: ${location.flow_high}</p>`;
    }

    detailsHTML += '</span>';

    // Update the Location Details section
    locationDetails.innerHTML = detailsHTML;
}

async function getGaugeDetails(gaugeId) {
    console.log('going into getGaugeDetails passing' + gaugeId);
    console.log(gaugeId);
    try {
        // Fetch the XML file
        const response = await fetch('./current_conditions.kml');
        const xmlText = await response.text();
        const details = {};
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Find the relevant Placemark
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        for (let placemark of placemarks) {
            const name = placemark.getElementsByTagName('name')[0]?.textContent;
            
            if (name === gaugeId) {
                // Extract data from ExtendedData
                const extendedData = placemark.getElementsByTagName('ExtendedData')[0];
                const dataElements = extendedData.getElementsByTagName('Data');
                const details = {};

                for (let data of dataElements) {
                    const dataName = data.getAttribute('name');
                    const dataValue = data.getElementsByTagName('value')[0]?.textContent;
                    
                    if (dataName === 'Latest Stage Value' || dataName === 'Latest Discharge Value') {
                        const match = dataValue.match(/([\d.]+)\s[^\s]+\s@\s([\d-]+)\s([\d:]+)/);
                        if (match) {
                            const [, value, date, time] = match;
                            if (dataName === 'Latest Stage Value') {
                                details.stage = parseFloat(value);
                            } else if (dataName === 'Latest Discharge Value') {
                                details.flow = parseFloat(value);
                            }
                            details.date = date;
                            details.time = time;
                        }
                    } else if (dataName === 'Current Condition') {
                        details.currentCondition = dataValue;
                    }
                }

                console.log('Gauge details: ' + details);
                
                return details;
            }
        }

        throw new Error(`Gauge ID ${gaugeId} not found in the XML.`);
    } catch (error) {
        console.error('Error fetching or parsing XML:', error);
        return null;
    }
    console.log('exiting getGaugeDetails');
}

const markers = {};

async function loadUserLocations() {
    try {
        const { data, error } = await supabase
            .from('user_location')
            .select('*');

        if (error) {
            console.error("Error loading user locations:", error);
            return;
        }

        // Get reference to the list element
        const locationsList = document.getElementById('user-locations-list');
        const locationDetails = document.getElementById('location-details');

        // Clear any existing items in the list
        locationsList.innerHTML = '';

        data.forEach(location => {                    
            const marker = L.marker([location.lat, location.lon], { icon: putInIcon, pane: 'userLocationsPane' } )
                .addTo(user_locations);

            const popupContent = `
                <h2>${location.name}</h2>
                <h3>${location.waterway}</h3>
                ${location.flow_rec && (!location.flow_high && !location.flow_low) ? `Flow recommendation: ${location.flow_rec}<br>` : ''}
                ${location.flow_low && location.flow_high && location.flow_rec ? `Flow: ${location.flow_low} - ${location.flow_high} (${location.flow_rec} rec)` : ''}
            `;

            markers[location.id] = marker;

            // Add a click event to the marker to update the location details
            marker.on('click',() => { 
                updateLocationDetails(marker, location); 
                populateTripsForLocation(location.id);
            });

            user_locations.addLayer(marker);

            // Create a list item for the location
            const listItem = document.createElement('li');
            listItem.textContent = location.name;

            // Add a click event to zoom to the marker on the map
            listItem.addEventListener('click', () => {
                map.setView([location.lat, location.lon], 12);

                updateLocationDetails(marker, location);                        
                
                marker.openPopup();

                // Populate the "Trips Starting From This Location" table
                populateTripsForLocation(location.id);
            });


            marker.bindPopup(popupContent);

            // Append the list item to the unordered list
            locationsList.appendChild(listItem);                  
        });

    } catch (err) {
        console.error("Unexpected error while loading user locations:", err);
    }
}    

loadUserLocations();
addPublicLaunches();

map.on('moveend',addPublicLaunches);
map.on('click', addUserLocation);

// Add the layer group to the map's layer control
var baseLayers = {
    "OpenStreetMap": osm
};

var overlayLayers = {
    "User Locations": user_locations,
    "Public Launches": public_launches
};

L.control.layers(baseLayers, overlayLayers).addTo(map);

// Function to show the "Add Trip" form
document.getElementById('add-trip-btn').addEventListener('click', () => {
    // Show the form
    document.getElementById('add-trip-form').style.display = 'block';
    
    // Optionally hide the button
    document.getElementById('add-trip-btn').style.display = 'none';
});

// Function to hide the "Add Trip" form
document.getElementById('cancel-trip-btn').addEventListener('click', () => {
    // Hide the form
    document.getElementById('add-trip-form').style.display = 'none';

    // Show the button again
    document.getElementById('add-trip-btn').style.display = 'block';
});

// Function to populate the dropdowns for "From" and "To" with user locations
async function loadLocationDropdowns() {
    try {
        const { data, error } = await supabase
            .from('user_location')
            .select('*');

        if (error) {
            console.error("Error loading user locations:", error);
            return;
        }

        const fromSelect = document.getElementById('from-location');
        const toSelect = document.getElementById('to-location');

        // Clear existing options
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';

        // Add default "Select" options
        fromSelect.innerHTML = '<option value="">Select a location</option>';
        toSelect.innerHTML = '<option value="">Select a location</option>';

        // Add locations as options
        data.forEach(location => {

            const option = document.createElement('option');
            option.value = location.id; // Assuming the location ID is a unique identifier
            option.textContent = location.name;
            fromSelect.appendChild(option);

            const toOption = document.createElement('option');
            toOption.value = location.id;
            toOption.textContent = location.name;
            toSelect.appendChild(toOption);
        });
    } catch (err) {
        console.error("Unexpected error while loading user locations:", err);
    }
}

async function addTrip(event) {
    event.preventDefault();

    const fromLocationId = document.getElementById('from-location').value || null;
    const toLocationId = document.getElementById('to-location').value || null;
    const startTime = document.getElementById('start-time').value || null;
    const endTime = document.getElementById('end-time').value || null;
    const distance = document.getElementById('distance').value || null;
    const flow = document.getElementById('flow').value || null;

    if (!fromLocationId || !toLocationId || !startTime || !endTime ) {
        alert('Please fill out all fields');
        return;
    }

    try {
        // Insert trip into the database (replace with the correct table and structure)
        const { data, error } = await supabase
            .from('triplog')
            .insert([{
                start_location: fromLocationId,
                started: startTime,
                end_location: toLocationId,
                ended: endTime,
                distance: distance,
                flow: flow
            }]);


        if (error) {
            console.error('Error saving trip:', error);
            alert('Failed to save the trip. Please try again.');
        } else {
            populateTripsTable();
        }
    } catch (err) {
        console.error('Unexpected error while adding trip:', err);
    }

    // Reset the form
    document.getElementById('trip-form').reset();
    document.getElementById('add-trip-form').style.display = 'none';
    document.getElementById('add-trip-btn').style.display = 'block';
}

// Event listener to handle trip form submission
document.getElementById('trip-form').addEventListener('submit', addTrip);

// Load locations when the page loads
loadLocationDropdowns();

async function populateTripsTable() {
    try {
        const { data, error } = await supabase
            .from('triplog') // Replace with the actual table name if it's different
            .select(`
                id,
                started,
                ended,
                flow,
                distance,
                start_location (id, name),
                end_location (id, name)
            `)
            .order('started', { ascending: true });

        if (error) {
            console.error("Error loading trips:", error);
            return;
        }

        const tripsTable = document.querySelector('.trips tbody');
        tripsTable.innerHTML = ''; // Clear the table before adding new rows

        // Populate the table with trips data
        data.forEach(trip => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${trip.started ? new Date(trip.started).toLocaleDateString() : 'N/A'}</td>
                <td>${trip.start_location?.name || 'Unknown'}</td>
                <td>${trip.end_location?.name || 'Unknown'}</td>
            `;

        // Add click event to show trip details
        newRow.addEventListener('click', () => {
            
            showTripDetails(trip);
        });

            tripsTable.appendChild(newRow);
        });
    } catch (err) {
        console.error("Unexpected error while populating trips table:", err);
    }
}

populateTripsTable();

async function showTripDetails(trip) {
    console.log('trip:')
    console.log(trip);

    const tripDetails = document.getElementById('trip-details');
    tripDetails.innerHTML = `
        <h2>Trip Details</h2>
        
        <p><strong>Date:</strong> ${trip.started ? new Date(trip.started).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</p>
        
        <p><strong>Start:</strong> ${trip.started ? new Date(trip.started).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
        <strong>End:</strong> ${trip.ended ? new Date(trip.ended).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
        
        <p><strong>Distance:</strong> ${trip.distance ? `${trip.distance} km` : 'N/A'}</p>
        
        <p><strong>Flow:</strong> ${trip.flow ? `${trip.flow} m³/s` : 'N/A'}</p>
    `;
    
    // Open the popup for the starting location
    const tripGaugeId = await getGaugeIdFromLocationId(trip.start_location.id);
    const waterway = await getWaterwayFromLocationId(trip.start_location.id);
    const locationName = await getLocationNameFromLocationId(trip.start_location.id);

    if (tripGaugeId) {
        // Fetch current conditions for the gauge
        const currentConditions = await getGaugeDetails(tripGaugeId);
        console.log("currentConditions:", currentConditions);

        // Check if marker exists and bind the popup
        if (trip.start_location && markers[trip.start_location.id]) {
            const currentConditions = await getGaugeDetails(tripGaugeId);

            let location = {
                name: locationName,
                waterway: waterway
            };

            const popupContent = generatePopupContent(location, currentConditions);
            
            console.log(popupContent);
            //marker.bindPopup(popupContent);
            markers[trip.start_location.id].bindPopup(popupContent).openPopup();
        }
    } else {
        const popupContent =  `
                <h2>${trip.start_location.name}</h2>
                <h3>${waterway}</h3>
            `;
        markers[trip.start_location.id].bindPopup(popupContent).openPopup();
        console.error('Gauge ID not found for the location.');
    }
}

async function getWaterwayFromLocationId(locationId) {
    console.log('getting waterway from location id' + locationId);
    try {
        const { data, error } = await supabase
            .from('user_location') // Replace with your actual table name
            .select('waterway') // Select only the gauge_id column
            .eq('id', locationId) // Match the location ID
            .single(); // Since locationId is unique, this ensures a single result

        if (error) {
            console.error('Error fetching waterway:', error);
            return null;
        }

        if (data && data.waterway) {
            return data.waterway;
        } else {
            console.error('Waterway not found for location ID:', locationId);
            return null;
        }
    } catch (err) {
        console.error('Unexpected error while fetching Waterway:', err);
        return null;
    }            
}

async function getLocationNameFromLocationId(locationId) {
    console.log('getting location name from location id' + locationId);
    try {
        const { data, error } = await supabase
            .from('user_location') // Replace with your actual table name
            .select('name') // Select only the gauge_id column
            .eq('id', locationId) // Match the location ID
            .single(); // Since locationId is unique, this ensures a single result

        if (error) {
            console.error('Error fetching name:', error);
            return null;
        }

        if (data && data.name) {
            return data.name;
        } else {
            console.error('Name not found for location ID:', locationId);
            return null;
        }
    } catch (err) {
        console.error('Unexpected error while fetching name:', err);
        return null;
    }            
}

async function getGaugeIdFromLocationId(locationId) {
    console.log('getting gauge id from location id' + locationId);
    try {
        const { data, error } = await supabase
            .from('user_location') // Replace with your actual table name
            .select('gauge_id') // Select only the gauge_id column
            .eq('id', locationId) // Match the location ID
            .single(); // Since locationId is unique, this ensures a single result

        if (error) {
            console.error('Error fetching gauge ID:', error);
            return null;
        }

        if (data && data.gauge_id) {
            return data.gauge_id;
        } else {
            console.error('Gauge ID not found for location ID:', locationId);
            return null;
        }
    } catch (err) {
        console.error('Unexpected error while fetching gauge ID:', err);
        return null;
    }
}

async function populateTripsForLocation(locationId) {
    try {
        // Query trips starting from the selected location
        const { data, error } = await supabase
            .from('triplog') // Replace with your actual table name
            .select(`
                started,
                ended,
                distance,
                flow,
                start_location (id, name),
                end_location (id, name)
            `)
            .eq('start_location', locationId); // Assuming start_location stores the location ID directly


        if (error) {
            console.error("Error loading trips for location:", error);
            return;
        }

        const tripsTableBody = document.querySelector('.starting-trip tbody');
        tripsTableBody.innerHTML = ''; // Clear existing rows

        // Populate the table with trips data
        data.forEach(trip => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${trip.started ? new Date(trip.started).toLocaleDateString() : 'N/A'}</td>
                <td>${trip.end_location?.name || 'Unknown'}</td>
                <td>${trip.distance || 'N/A'} km</td>
                <td>${trip.flow || 'N/A'} m³/s</td>
            `;
            tripsTableBody.appendChild(newRow);

            // Show the table
            showTripsTable();
        });

    } catch (err) {
        console.error("Unexpected error while populating trips for location:", err);
    }
}

function showTripsTable() {
    const tripsLog = document.getElementById('tripslog');
    tripsLog.classList.remove('hidden'); // Remove the hidden class to make it visible
}

function generatePopupContent(location, currentConditions) {
    
    return `
        <h2>${location.name}</h2>
        <h3>${location.waterway}</h3>
        
        <p class="flow">Flow (m³/s)<br><span class="flow">${currentConditions.flow}</span><br>
        Level: <strong>${currentConditions.stage} m</strong></p>
        <p>${currentConditions.currentCondition}</p>
        <p class="smaller">Recorded ${currentConditions.date} ${currentConditions.time}</p>
    `;
}
