export interface ProviderCatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  direction: "inbound" | "outbound" | "bidirectional";
  capabilities: string[];
  access: string;
  status: "available_to_integrate" | "access_required" | "not_connected";
}
/** Extensible catalogue only. A catalogue entry is never evidence of a connection. */
export const providerCatalog: ProviderCatalogEntry[] = [
  {
    id: "booking",
    name: "Booking.com",
    category: "Canales de venta",
    description: "Reservas y distribución hotelera.",
    direction: "bidirectional",
    capabilities: ["Reservas", "Disponibilidad", "Tarifas"],
    access: "Requiere autorización oficial de socio.",
    status: "access_required",
  },
  {
    id: "expedia",
    name: "Expedia",
    category: "Canales de venta",
    description: "Conectividad con la distribución de Expedia.",
    direction: "bidirectional",
    capabilities: ["Reservas", "Disponibilidad"],
    access: "Requiere acceso oficial y credenciales del hotel.",
    status: "access_required",
  },
  {
    id: "airbnb",
    name: "Airbnb",
    category: "Canales de venta",
    description: "Reservas y comunicación cuando la API lo permita.",
    direction: "bidirectional",
    capabilities: ["Reservas"],
    access: "Requiere autorización de Airbnb.",
    status: "access_required",
  },
  {
    id: "channel-manager",
    name: "Channel Managers",
    category: "Distribución",
    description: "Conexión con channel managers compatibles.",
    direction: "bidirectional",
    capabilities: ["Reservas", "Disponibilidad", "Tarifas", "Restricciones"],
    access: "Depende del proveedor y de su API oficial.",
    status: "available_to_integrate",
  },
  {
    id: "booking-engine",
    name: "Motores de reservas",
    category: "Distribución",
    description: "Reservas desde el motor de la web del hotel.",
    direction: "inbound",
    capabilities: ["Reservas", "Huéspedes"],
    access: "Requiere documentación y credenciales del motor.",
    status: "available_to_integrate",
  },
  {
    id: "payments",
    name: "Proveedores de pagos",
    category: "Pagos",
    description: "Cobros y estados de pago soportados por cada proveedor.",
    direction: "bidirectional",
    capabilities: ["Pagos"],
    access: "No hay proveedor de pagos conectado.",
    status: "not_connected",
  },
  {
    id: "guest-services",
    name: "Gestión de huéspedes",
    category: "Servicios hoteleros",
    description: "Servicios externos de experiencia y gestión del huésped.",
    direction: "bidirectional",
    capabilities: ["Huéspedes", "Eventos"],
    access: "Requiere API oficial del servicio.",
    status: "available_to_integrate",
  },
  {
    id: "custom-api",
    name: "Integraciones personalizadas",
    category: "API propia",
    description: "Aplicaciones que envían o consultan datos autorizados del PMS.",
    direction: "bidirectional",
    capabilities: ["API Key", "Reservas", "Disponibilidad", "Registros"],
    access: "Disponible mediante API DE SUITE HOTEL OS.",
    status: "available_to_integrate",
  },
];
