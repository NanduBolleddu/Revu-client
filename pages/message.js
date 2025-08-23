import PrivateChat from '../components/PrivateChat';

export default function MessagesPage({ keycloak }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col">
      <PrivateChat keycloak={keycloak} />
    </div>
  );
}
