// --- State Management ---
        let allCategories = []; // Stores all fetched categories
        let currentCategory = null; // Tracks the currently viewed category for back navigation
        let currentSearchTerm = ''; // Stores the current search term for back navigation

        // API endpoints for fetching meal data
        const API = {
            categories: 'https://www.themealdb.com/api/json/v1/1/categories.php',
            mealsByCategory: 'https://www.themealdb.com/api/json/v1/1/filter.php?c=',
            searchMeal: 'https://www.themealdb.com/api/json/v1/1/search.php?s=',
            mealDetails: 'https://www.themealdb.com/api/json/v1/1/lookup.php?i=',
        };

        // References to key DOM elements for easier manipulation
        const DOMElements = {
            loader: document.getElementById('loader'),
            header: {
                menuButton: document.getElementById('menu-button'),
                backButtonContainer: document.getElementById('back-button-container'),
                homeLink: document.querySelector('h1 a'), 
            },
            sidebar: {
                self: document.getElementById('sidebar'),
                overlay: document.getElementById('sidebar-overlay'),
                closeButton: document.getElementById('close-button'),
                categoryList: document.getElementById('sidebar-category-list'),
            },
            heroSection: document.getElementById('hero-section'),
            search: {
                form: document.getElementById('search-form'),
                input: document.getElementById('search-input'),
            },
            content: {
                categoriesSection: document.getElementById('categories-section'),
                categoriesGrid: document.getElementById('categories-grid'),
                mealsSection: document.getElementById('meals-section'),
                categoryDescription: document.getElementById('category-description-container'),
                mealsTitle: document.getElementById('meals-title'),
                mealsGrid: document.getElementById('meals-grid'),
                mealDetailsSection: document.getElementById('meal-details-section'),
            },
        };

        // --- Helper Functions ---
        // Toggles the visibility of the loading spinner
        const toggleLoader = (show) => DOMElements.loader.classList.toggle('hidden', !show);
        
        // Opens the sidebar menu
        const openSidebar = () => {
            DOMElements.sidebar.self.classList.add('open');
            DOMElements.sidebar.overlay.classList.remove('hidden');
        };
        
        // Closes the sidebar menu
        const closeSidebar = () => {
            DOMElements.sidebar.self.classList.remove('open');
            DOMElements.sidebar.overlay.classList.add('hidden');
        };
        
        /**
         * Helper function to fetch full meal details for a list of basic meal objects.
         * This is necessary because the category and search APIs only return basic meal info,
         * but the display requires category, area, and tags.
         * @param {Array} basicMeals - An array of meal objects with at least idMeal, strMeal, strMealThumb.
         * @returns {Promise<Array>} A promise that resolves to an array of full meal objects.
         */
        async function fetchFullMealDetailsForList(basicMeals) {
            if (!basicMeals || basicMeals.length === 0) return [];
            const detailedMeals = [];
            // Use Promise.all to fetch details concurrently for better performance
            const fetchPromises = basicMeals.map(async (basicMeal) => {
                try {
                    const response = await fetch(`${API.mealDetails}${basicMeal.idMeal}`);
                    const data = await response.json();
                    if (data.meals && data.meals.length > 0) {
                        return data.meals[0];
                    }
                } catch (error) {
                    console.error(`Failed to fetch details for meal ID ${basicMeal.idMeal}:, error`);
                }
                return null; // Return null for failed fetches
            });

            const results = await Promise.all(fetchPromises);
            return results.filter(meal => meal !== null); // Filter out any failed fetches
        }

        // --- View Management ---
        /**
         * Manages which sections of the page are visible based on the current view.
         * @param {string} viewName - The name of the view to show ('categories', 'meals', 'details').
         */
        const showView = (viewName) => {
            const { heroSection, content, header } = DOMElements;
            const { categoriesSection, mealsSection, mealDetailsSection } = content;
            
            // Hide all content sections by default
            categoriesSection.classList.add('hidden');
            mealsSection.classList.add('hidden');
            mealDetailsSection.classList.add('hidden');
            
            // Manage back button and menu button visibility
            header.backButtonContainer.classList.add('hidden');
            header.menuButton.classList.remove('hidden');

            switch(viewName) {
                case 'categories':
                    heroSection.classList.remove('hidden'); 
                    categoriesSection.classList.remove('hidden'); // Always show categories on home
                    mealsSection.classList.add('hidden'); // Hide meals section
                    currentCategory = null; // Reset current category
                    currentSearchTerm = ''; // Reset search term
                    DOMElements.content.mealsGrid.innerHTML = ''; // Clear meals grid
                    DOMElements.content.categoryDescription.innerHTML = ''; // Clear category description
                    DOMElements.content.mealsTitle.textContent = 'MEALS'; // Reset meals title
                    break;
                case 'meals':
                    heroSection.classList.remove('hidden'); 
                    mealsSection.classList.remove('hidden'); 
                    categoriesSection.classList.remove('hidden'); // Keep categories grid visible below meals/search results
                    header.backButtonContainer.classList.remove('hidden'); // Show back button
                    header.menuButton.classList.add('hidden'); // Hide menu button
                    break;
                case 'details':
                    heroSection.classList.remove('hidden'); // Keep hero section visible as requested
                    categoriesSection.classList.remove('hidden'); // Show categories below meal details as requested
                    mealsSection.classList.add('hidden'); // Hide meals section
                    mealDetailsSection.classList.remove('hidden'); // Show meal details section
                    header.backButtonContainer.classList.remove('hidden'); // Show back button
                    header.menuButton.classList.add('hidden'); // Hide menu button
                    break;
            }
            window.scrollTo(0, 0); // Scroll to top on view change
        };

        /**
         * Handles the click event for the back button.
         * Navigates back to the previous view (meal list or categories).
         * @param {Event} event - The click event object.
         */
        function handleBackClick(event) {
            event.preventDefault();
            // If currently viewing meal details, go back to the meals list of the current category/search
            if (!DOMElements.content.mealDetailsSection.classList.contains('hidden')) {
                if (currentCategory) {
                    fetchAndDisplayMealsByCategory(currentCategory);
                } else if (currentSearchTerm) {
                    searchAndDisplayMeals(currentSearchTerm);
                } else {
                    showView('categories'); // Fallback to categories view
                }
            } else if (!DOMElements.content.mealsSection.classList.contains('hidden')) {
                // If currently viewing meals list, go back to categories view
                showView('categories');
            }
        }
        
        /**
         * Shows the categories view and fetches/displays categories.
         * Used for the "Home" link in the header.
         * @param {Event} event - The click event object (optional).
         */
        function showCategoriesView(event) {
            if (event) event.preventDefault();
            showView('categories'); 
            fetchAndDisplayCategories(); // Re-fetch categories to ensure they are always fresh
        }

        // --- Data Fetching and Display ---
        /**
         * Fetches all meal categories from the API and displays them.
         */
        async function fetchAndDisplayCategories() {
            toggleLoader(true); // Show loader
            try {
                const response = await fetch(API.categories);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                allCategories = data.categories; // Store categories globally
                displayCategories(allCategories);
                populateSidebar(allCategories); // Populate sidebar with categories
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                DOMElements.content.categoriesGrid.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load categories. Please try again later.</p>`;
            } finally {
                toggleLoader(false); // Hide loader
            }
        }

        /**
         * Displays category cards in the categories grid.
         * @param {Array} categories - An array of category objects.
         */
        function displayCategories(categories) {
            DOMElements.content.categoriesGrid.innerHTML = ''; // Clear previous categories
            categories.forEach(category => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-lg shadow-md overflow-hidden cursor-pointer relative card-hover';
                card.innerHTML = `
                    <img src="${category.strCategoryThumb}" alt="${category.strCategory}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/300x300/f8f9fa/ccc?text=Image+Not+Found';">
                    <span class="category-tag">${category.strCategory}</span>
                `;
                card.addEventListener('click', () => fetchAndDisplayMealsByCategory(category.strCategory));
                DOMElements.content.categoriesGrid.appendChild(card);
            });
        }
        
        /**
         * Populates the sidebar with clickable category links.
         * @param {Array} categories - An array of category objects.
         */
        function populateSidebar(categories) {
            DOMElements.sidebar.categoryList.innerHTML = '';
            categories.forEach(category => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" class="block py-2 px-4 rounded-md text-gray-700 hover:bg-orange-100 hover:text-orange-600">${category.strCategory}</a>`;
                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    closeSidebar();
                    fetchAndDisplayMealsByCategory(category.strCategory);
                });
                DOMElements.sidebar.categoryList.appendChild(li);
            });
        }

        /**
         * Fetches meals belonging to a specific category and displays them.
         * @param {string} categoryName - The name of the category to fetch meals for.
         */
        async function fetchAndDisplayMealsByCategory(categoryName) {
            showView('meals'); // Switch to meals view
            toggleLoader(true); // Show loader
            currentCategory = categoryName; // Set current category for back navigation
            currentSearchTerm = ''; // Clear search term

            // Find category data to display description
            const categoryData = allCategories.find(c => c.strCategory === categoryName);
            DOMElements.content.categoryDescription.innerHTML = `
                <h3 class="text-xl font-bold mb-2 text-orange-600">${categoryData.strCategory} Meals</h3>
                <p class="text-gray-600">${categoryData.strCategoryDescription}</p>
            `;
            DOMElements.content.mealsTitle.textContent = `MEALS IN ${categoryName.toUpperCase()};` // Update meals title

            try {
                const response = await fetch(`${API.mealsByCategory}${categoryName}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const basicMeals = data.meals; // Basic meal info (id, name, thumb)

                // Fetch full details for each basic meal concurrently
                const detailedMeals = basicMeals ? await fetchFullMealDetailsForList(basicMeals) : [];
                displayMeals(detailedMeals); // Display meals with full details

            } catch (error) {
                console.error("Failed to fetch meals by category:", error);
                DOMElements.content.mealsGrid.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load meals for this category. Please try again later.</p>`;
            } finally {
                toggleLoader(false); // Hide loader
            }
        }
        
        /**
         * Displays meal cards in the meals grid.
         * Each meal object is expected to have full details (from mealDetails API).
         * @param {Array} meals - An array of full meal objects.
         */
        function displayMeals(meals) {
            const grid = DOMElements.content.mealsGrid;
            grid.innerHTML = ''; // Clear previous meals
            if (!meals || meals.length === 0) {
                grid.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No meals found for this selection.</p>`;
                return;
            }
            meals.forEach(meal => {
                const tags = meal.strTags ? meal.strTags.split(',').map(tag => tag.trim()).filter(t => t).join(', ') : '';
                const area = meal.strArea ? meal.strArea : '';

                const card = document.createElement('div');
                card.className = 'bg-white rounded-lg shadow-md overflow-hidden card-hover cursor-pointer relative';
                card.innerHTML = `
                    <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/300x300/f8f9fa/ccc?text=Image+Not+Found';">
                    ${meal.strCategory ? `<span class="category-tag">${meal.strCategory}</span>`: ''} 
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-800 truncate">${meal.strMeal}</h3>
                        ${area ? `<p class="text-sm text-gray-600">${area}</p> `: ''}
                        ${tags ? `<p class="text-sm text-gray-500">${tags}</p> `: ''}
                    </div>
                `;
                card.addEventListener('click', () => fetchAndDisplayMealDetails(meal.idMeal));
                grid.appendChild(card);
            });
        }
        
        /**
         * Fetches and displays detailed information for a single meal.
         * @param {string} mealId - The ID of the meal to fetch details for.
         */
        async function fetchAndDisplayMealDetails(mealId) {
            showView('details'); // Switch to details view
            toggleLoader(true); // Show loader
            DOMElements.content.mealDetailsSection.innerHTML = ''; // Clear previous details
            try {
                const response = await fetch(`${API.mealDetails}${mealId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.meals && data.meals.length > 0) {
                    displayMealDetails(data.meals[0]);
                } else {
                    DOMElements.content.mealDetailsSection.innerHTML = `<p class="text-gray-500 text-center py-8">Meal details not found.</p>`;
                }
            } catch (error) {
                console.error("Failed to fetch meal details:", error);
                DOMElements.content.mealDetailsSection.innerHTML = `<p class="text-red-500 text-center py-8">Failed to load meal details. Please try again later.</p>`;
            } finally {
                toggleLoader(false); // Hide loader
            }
        }

        /**
         * Renders the detailed view of a specific meal, including ingredients, measures, and instructions.
         * This function incorporates all the specific styling requests.
         * @param {Object} meal - The meal object containing full details.
         */
        function displayMealDetails(meal) {
            let ingredientsHtml = '';
            // Loop through ingredients (up to 20 as per API structure)
            for (let i = 1; i <= 20; i++) {
                const ingredient = meal[`strIngredient${i}`];
                if (ingredient && ingredient.trim() !== '') {
                    // Ingredients displayed side-by-side (3 per line) with numbered skyblue round backgrounds
                    ingredientsHtml += `
                        <li class="flex items-center space-x-2 text-white">
                            <div class="ingredient-number-circle">${i}</div>
                            <span>${ingredient}</span>
                        </li>
                    `;
                }
            }

            let measuresHtml = '';
            // Loop through measures (up to 20 as per API structure)
            for (let i = 1; i <= 20; i++) {
                const measure = meal[`strMeasure${i}`];
                if (measure && measure.trim() !== '') {
                    // Measure items with orange background and white text
                    measuresHtml += `
                        <div class="measure-item">
                            <span class="arrow">&rarr;</span>
                            <span>${measure}</span>
                        </div>
                    `;
                }
            }

            // Tags with orange border, no background, orange text
            const tags = meal.strTags ? meal.strTags.split(',').map(tag => `<span class="border border-orange-500 text-orange-500 text-sm font-semibold px-3 py-1 rounded-full shadow-sm">${tag.trim()}</span>`).join('') : 'None';
            
            // Format instructions into points with orange tick boxes, occupying entire row
            const instructionsArray = meal.strInstructions ? meal.strInstructions.split('\r\n').filter(instruction => instruction.trim() !== '') : [];
            let instructionsHtml = '';
            instructionsArray.forEach((instruction, index) => {
                instructionsHtml += `
                    <div class="instruction-item">
                        <div class="instruction-tickbox">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <p class="text-gray-700 flex-grow">${instruction.trim()}</p>
                    </div>
                `;
            });

            const detailsHtml = `
                <!-- Breadcrumb: Home symbol and meal name in one line, orange background, slightly larger font -->
                <div class="bg-orange-500 text-white py-3 px-4 rounded-lg shadow-md mb-4">
                    <div class="text-base md:text-lg flex items-center">
                        <a href="#" onclick="showCategoriesView(event)" class="hover:underline flex items-center inline-block">
                            <svg class="w-5 h-5 inline-block align-text-bottom" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg> 
                        </a> 
                        <span class="mx-2 font-bold">>></span> 
                        <span class="font-semibold">${meal.strMeal}</span>
                    </div>
                </div>
                <h2 class="text-2xl font-bold text-gray-800 uppercase mb-6">MEAL DETAILS</h2> 
                <div class="bg-white p-6 rounded-lg shadow-lg"> 
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Left Column: Meal Image -->
                        <div class="md:col-span-1 flex flex-col space-y-6">
                            <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="w-full h-auto object-cover rounded-lg shadow-md" onerror="this.onerror=null;this.src='https://placehold.co/300x300/f8f9fa/ccc?text=Image+Not+Found';">
                        </div>

                        <!-- Right Column: Category, Source, Tags, Ingredients -->
                        <div class="md:col-span-1 flex flex-col space-y-4">
                            <!-- Meal Name with Orange Color and Orange Underline -->
                            <h3 class="text-3xl font-bold text-orange-500 pb-2 border-b-2 border-orange-500">${meal.strMeal}</h3>

                            <!-- Category -->
                            <p class="text-lg text-gray-700"><span class="font-bold">CATEGORY:</span> ${meal.strCategory || 'N/A'}</p>
                            
                            <!-- Source Link -->
                            ${meal.strSource ? `
                                <p class="text-lg text-gray-700">
                                    <span class="font-bold">Source:</span> 
                                    <a href="${meal.strSource}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                                        ${meal.strSource.length > 50 ? meal.strSource.substring(0, 50) + '...' : meal.strSource}
                                    </a>
                                </p>
                            ` : ''}

                            <!-- Tags (straight to the tags) -->
                            <div class="flex items-center flex-wrap gap-2">
                                <span class="font-bold text-gray-700">Tags:</span>
                                ${tags}
                            </div>

                            <!-- Ingredients Section (Orange background, right side of the fig) -->
                            <div class="bg-orange-500 p-6 rounded-lg shadow-lg mt-4">
                                <h3 class="text-2xl font-bold text-white mb-4">Ingredients</h3>
                                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${ingredientsHtml || '<li class="text-white text-opacity-80">No ingredients listed.</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <!-- Measures Section (Below Ingredients) -->
                    <div class="mt-8 bg-gray-100 p-6 rounded-lg shadow-lg">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4">Measures</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${measuresHtml || '<p class="text-gray-600">No measures listed.</p>'}
                        </div>
                    </div>

                    <!-- Instructions Section (Below Measures) -->
                    <div class="mt-8 bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                        <h3 class="text-2xl font-bold text-gray-800 mb-4">Instructions</h3>
                        <div class="space-y-3">
                            ${instructionsHtml || '<p class="text-gray-600">No instructions provided.</p>'}
                        </div>
                    </div>

                    <!-- Removed YouTube Video Section as requested -->
                    <!-- Original Source Link is now removed entirely as requested -->
                </div>
            `;
            DOMElements.content.mealDetailsSection.innerHTML = detailsHtml;
        }

        /**
         * Handles the search form submission.
         * Fetches meals based on the search term and displays them.
         * @param {Event} event - The form submission event.
         */
        async function searchAndDisplayMeals(searchTerm) {
            if (!searchTerm.trim()) {
                // Replaced alert with a simple console log or you could implement a custom modal
                console.log('Please enter a meal name to search.');
                return;
            }
            showView('meals'); // Switch to meals view
            toggleLoader(true); // Show loader
            currentSearchTerm = searchTerm; // Set current search term for back navigation
            currentCategory = null; // Clear current category

            DOMElements.content.categoryDescription.innerHTML = ''; // Clear category description for search results
            DOMElements.content.mealsTitle.textContent = `SEARCH RESULTS FOR "${searchTerm.toUpperCase()}";` // Update meals title

            try {
                const response = await fetch(`${API.searchMeal}${searchTerm}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const basicMeals = data.meals; // Basic meal info (id, name, thumb)

                // Fetch full details for each basic meal concurrently
                const detailedMeals = basicMeals ? await fetchFullMealDetailsForList(basicMeals) : [];
                displayMeals(detailedMeals); // Display meals with full details

            } catch (error) {
                console.error("Failed to fetch search results:", error);
                DOMElements.content.mealsGrid.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load search results. Please try again later.</p>`;
            } finally {
                toggleLoader(false); // Hide loader
            }
        }

        // --- Event Listeners ---
        document.addEventListener('DOMContentLoaded', () => {
            // Initial load: show categories
            showCategoriesView(); 

            // Sidebar toggle
            DOMElements.header.menuButton.addEventListener('click', openSidebar);
            DOMElements.sidebar.closeButton.addEventListener('click', closeSidebar);
            DOMElements.sidebar.overlay.addEventListener('click', closeSidebar);

            // Search form submission
            DOMElements.search.form.addEventListener('submit', (e) => {
                e.preventDefault();
                const searchTerm = DOMElements.search.input.value;
                searchAndDisplayMeals(searchTerm);
            });
        });