// sw.js - Service Worker para background sync e cache de localizações

const CACHE_NAME = 'localizacao-v1';
const API_URL = 'https://lslcda-default-rtdb.firebaseio.com/';
const SYNC_TAG = 'sync-locations';

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll([
                    '/',
                    '/index.html',
                    '/styles.css',
                    '/app.js'
                ]);
            })
    );
});

// Estratégia de rede com fallback para cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se a requisição é para a API de localização, faz cache
                if (event.request.url.includes('ultima_localizacao')) {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, clonedResponse));
                }
                return response;
            })
            .catch(() => {
                // Fallback para cache quando offline
                return caches.match(event.request);
            })
    );
});

// Background Sync para enviar localizações pendentes
self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        event.waitUntil(
            enviarLocalizacoesPendentes()
        );
    }
});

// Armazena localizações quando offline
async function armazenarLocalizacaoOffline(localizacao) {
    const cache = await caches.open(CACHE_NAME);
    const pendingLocations = await cache.match('pending-locations') || [];
    
    let locations = [];
    if (pendingLocations) {
        locations = await pendingLocations.json();
    }
    
    locations.push(localizacao);
    await cache.put('pending-locations', new Response(JSON.stringify(locations)));
}

// Envia localizações armazenadas
async function enviarLocalizacoesPendentes() {
    const cache = await caches.open(CACHE_NAME);
    const pendingResponse = await cache.match('pending-locations');
    
    if (!pendingResponse) return;
    
    const locations = await pendingResponse.json();
    
    for (const loc of locations) {
        try {
            const response = await fetch(`${API_URL}${loc.empresa}/${loc.setor}/veiculos/${loc.veiculo}/ultima_localizacao.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loc)
            });
            
            if (response.ok) {
                // Remove do cache se enviado com sucesso
                locations.splice(locations.indexOf(loc), 1);
            }
        } catch (error) {
            console.error('Falha ao enviar localização pendente:', error);
        }
    }
    
    // Atualiza o cache com as localizações restantes
    await cache.put('pending-locations', new Response(JSON.stringify(locations)));
}

// Mensagens da thread principal
self.addEventListener('message', (event) => {
    if (event.data.type === 'STORE_LOCATION') {
        const { location, empresa, setor, veiculo } = event.data;
        const locData = {
            ...location,
            empresa,
            setor,
            veiculo,
            timestamp: new Date().toISOString()
        };
        
        event.waitUntil(
            armazenarLocalizacaoOffline(locData)
                .then(() => self.registration.sync.register(SYNC_TAG))
        );
    }
});

// Atualização periódica em segundo plano (para navegadores que suportam)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-location') {
        event.waitUntil(
            enviarLocalizacoesPendentes()
        );
    }
});