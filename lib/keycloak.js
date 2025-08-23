import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8080/",
  realm: "revu",
  clientId: "revu-client-public", // public client for frontend
});

export default keycloak;
