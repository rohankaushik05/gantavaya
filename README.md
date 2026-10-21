Gantavaya --- Ride Booking Application
1. Introduction
Gantavaya is a full-stack ride-booking web application designed to
connect customers who need transportation with drivers who can provide
rides. The project demonstrates the main workflow of a ride-hailing
platform: account authentication, selecting pickup and destination
locations, requesting a ride, viewing ride information, managing ride
status, and handling payments.

The application is built with a React frontend and a Node.js/Express
backend. It uses Clerk for authentication and PostgreSQL hosted through
Supabase for persistent data storage.
2. Project Research and Background
Ride-hailing applications combine several important software features:
user authentication, location-based interfaces, booking workflows,
status management, payment processing, and secure communication between
the frontend and backend.

Before implementation, the project requirements were considered in terms
of:
- User roles: customers and drivers need different views and
  actions.
- Location selection: customers need to identify pickup and
  destination points on a map.
- Ride lifecycle: a ride request must be stored and its status
  updated as the workflow progresses.
- Payments: checkout and payment status need to be connected to
  the relevant ride or customer.
- Data security: protected API operations must validate the
  signed-in user's identity.
- Maintainability: frontend, backend, authentication, database,
  mapping, and payment responsibilities should be separated.
These considerations informed the selection of the technologies and
libraries described below.
3. Objectives
The main objectives of Gantavaya are to:
1. Provide a web interface for customers to request rides.
2. Allow pickup and destination locations to be selected using a map.
3. Calculate route information, including estimated distance, duration,
   and fare.
4. Support customer and driver workflows through authenticated API
   endpoints.
5. Store ride and related application data in a PostgreSQL database.
6. Integrate a payment checkout workflow.
7. Provide supporting features such as ride history, payment records,
   profile management, reviews, and support requests where available in
   the application.
8. Deploy the frontend and backend as separate services.
4. Technology Stack and Reasons for Selection
  Technology              Purpose                 Reason for selection
  React                   Frontend user interface Component-based
                                                  development makes
                                                  interactive screens
                                                  easier to build and
                                                  maintain.

  Vite                    Frontend development    Provides a fast
                          and build tooling       development server and
                                                  a straightforward
                                                  production build.

  Node.js                 Backend runtime         Allows server-side
                                                  JavaScript and
                                                  integration with the
                                                  frontend's JavaScript
                                                  ecosystem.

  Express.js              Backend API framework   Provides a lightweight
                                                  way to define REST API
                                                  routes and middleware.

  PostgreSQL              Relational database     Stores structured data
                                                  such as users, rides,
                                                  payments, and related
                                                  records with relational
                                                  consistency.

  Supabase                Hosted PostgreSQL       Provides managed
                          platform                database hosting and
                                                  connection details for
                                                  the application.

  Clerk                   Authentication          Provides sign-in,
                                                  sign-up, session
                                                  management, and
                                                  frontend authentication
                                                  components.

  Leaflet                 Interactive maps        Supports map display
                                                  and location selection
                                                  in the browser.

  OpenStreetMap           Map data                Supplies map tiles and
                                                  geographic context for
                                                  the map interface.

  OSRM                    Route information       Provides routing
                                                  information used to
                                                  estimate route distance
                                                  and duration.

  Stripe Checkout         Payment flow            Provides a hosted
                                                  checkout experience for
                                                  payment testing and
                                                  integration.

  Resend                  Email integration       Supports sending
                                                  application emails,
                                                  such as payment-related
                                                  messages, when
                                                  configured for the
                                                  target environment.

  Vercel                  Frontend hosting        Hosts the built
                                                  React/Vite frontend.

  Render                  Backend hosting         Hosts the
                                                  Node.js/Express API as
                                              a web service.
5. Libraries and Their Functions
The following libraries and services support the application's main
features:
- react and react-dom --- build and render the frontend
  interface.
- vite --- runs the frontend development server and creates the
  production build.
- express --- defines backend routes and handles HTTP requests.
- cors --- configures which frontend origins are allowed to call
  the backend API.
- pg --- connects the Node.js backend to PostgreSQL.
- @clerk/react --- provides frontend authentication components
  and access to the current session.
- @clerk/express --- supports authentication and session-token
  verification in backend routes.
- leaflet and react-leaflet --- provide interactive map
  functionality in the frontend.
- Stripe SDK / Stripe Checkout integration --- creates and
  verifies the checkout workflow using server-side payment operations.
- Resend SDK --- supports email sending through the Resend
  service.
- dotenv (if used by the backend setup) --- loads local
  environment variables during development.
- nodemon --- restarts the backend automatically during
  development when source files change. Production hosting runs the
  server directly rather than relying on Nodemon.
Exact package availability can be confirmed in the frontend and backend
package.json files.
6. Main Project Functionality
6.1 Authentication
Users can sign in or create an account using Clerk. The frontend obtains
an authentication token for protected requests, and the backend uses
authentication middleware to restrict access to user-specific
operations.
6.2 Ride Booking
Customers can enter or select a pickup point and destination. The
application sends the selected locations and relevant ride details to
the backend, which stores the ride request in the database.
6.3 Map and Route Information
The map interface allows users to select geographic locations. Route
information is used to display the journey and calculate estimates such
as distance, duration, and fare. The estimates depend on the available
mapping and routing services.
6.4 Customer and Driver Workflows
The application includes role-aware functionality for customer and
driver workflows. Customers can review their rides and manage relevant
ride actions. Driver-facing functionality supports viewing and managing
ride-related information provided by the application.
6.5 Ride Status and Cancellation
Ride records include a status that represents the current stage of a
booking. The application provides ride cancellation and status-related
operations through backend API endpoints, subject to the applicable user
and ride checks.
6.6 Payments
The payment workflow uses Stripe Checkout. The backend creates a
checkout session and verifies the returned session before updating the
corresponding payment record. The current integration is intended for
Stripe test mode unless production payment credentials and
configuration have explicitly been enabled. Test mode does not process
real customer payments.
6.7 Additional Supporting Features
The application also contains supporting areas for payment records,
profile settings, reviews, and support requests. Availability and
behavior of each feature depend on the implemented routes and the
configured services.
7. Application Architecture
Gantavaya separates the frontend from the backend:
1. Frontend: React and Vite render the application and send API
   requests.
2. Authentication: Clerk manages user sessions and supplies
   authentication tokens.
3. Backend: Node.js and Express expose API endpoints, validate
   requests, and coordinate business logic.
4. Database: PostgreSQL hosted through Supabase persists
   application records.
5. External services: Leaflet/OpenStreetMap and OSRM support
   mapping and routing; Stripe supports checkout; Resend supports
   email.
6. Deployment: Vercel hosts the frontend and Render hosts the
   backend API.
This separation keeps interface code, API logic, persistent storage, and
external integrations organized into distinct responsibilities.
8. Environment Configuration and Security
Environment-specific settings and secret credentials should be
configured through local environment files during development and the
hosting providers' environment-variable dashboards after deployment.

Examples include database connection details, Clerk keys, Stripe secret
keys, Resend credentials, and the deployed frontend URL. Secret keys
must never be committed to the public repository or embedded in frontend
code. Only publishable client-side keys should be exposed to the
browser.

The backend's CORS configuration must allow the deployed frontend
origin. Authentication and database access should be checked in the
deployed environment, not inferred solely from a successful build or
deployment.
9. Testing and Deployment
During development, the application was tested through local
frontend/backend runs and API requests. The project was then prepared
for deployment using GitHub as the source repository, Vercel for the
frontend, and Render for the backend.

A successful deployment confirms that a service has built and started;
it does not by itself prove that every integrated feature works in
production. Final verification should include:
- Signing in through the deployed frontend.
- Loading user-specific data.
- Booking and viewing a ride.
- Checking ride status and cancellation.
- Testing the Stripe Checkout flow in test mode.
- Confirming that backend requests succeed without CORS errors.
- Checking backend logs and database connectivity if a request fails.
10. Limitations and Future Improvements
Possible future improvements include:
- Switching Clerk from development credentials to a configured
  production instance.
- Completing production-domain configuration for all integrated
  services.
- Testing and strengthening authorization rules for each user role.
- Adding real-time driver location updates and ride-status
  notifications if required.
- Improving validation, error messages, loading states, and
  accessibility.
- Completing end-to-end tests for ride booking, cancellation, payment
  verification, and email delivery.
- Configuring verified sender domains and production email delivery
  where required.
- Adding monitoring, rate limiting, and additional operational
  safeguards.
11. Conclusion
Gantavaya demonstrates the development of a full-stack ride-booking
application using a modern JavaScript stack. It brings together a React
interface, an Express API, PostgreSQL persistence, Clerk authentication,
map and routing services, and a Stripe Checkout integration. The project
provides practical experience in frontend-backend communication,
protected API design, database operations, third-party integrations, and
cloud deployment.

The project can be extended with more complete real-time tracking,
production service configuration, stronger automated testing, and
additional driver/customer features as the requirements evolve.