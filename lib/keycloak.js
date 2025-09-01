import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'https://chipmunk-quality-secretly.ngrok-free.app',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'livedraft',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'livedraft-frontend'
});

export default keycloak;
