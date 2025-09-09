# AP Controller - system zarządzania punktami dostępowymi (AP) dla OpenWrt/LuCI
 
[English version](README.md)
 
Aplikacja to lekki system zarządzania punktami dostępowymi (Access Points), zbudowany jako rozszerzenie dla OpenWrt/LuCI. Jej głównym celem jest monitorowanie urządzeń sieciowych oraz automatyzacja procesów tworzenia i aktualizacji sieci Wi-Fi bez konieczności instalacji dodatkowych pakietów na punktach dostępowych.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices.png">
 
Aplikacja umożliwia:
- dodawanie i definiowania urządzeń (pracujących pod kontrolą OpenWrt) oraz wprowadzenie danych dostępnych (takich jak adres IP, port, login i hasło użytkownika)
- włączenie/wyłącenie monitorowania urządzeń oraz prezentacja parametrów ich pracy
- pobieranie logów z urządzenia, możliwość rebootu i pingowania urządzenia
- definiowanie sieci Wi-Fi
- definiowanie grup AP przez powiązanie sieci Wi-Fi oraz urządzeń
- wysyłanie konfiguracji sieci do włączonych urządzeń
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices-edit.png">
 
Monitoring urządzeń odbywa się cyklicznie przez skrypt wykonywany w cronie. Aby urządzenie było monitorowane wymagane jest jego włączenie (opcja "Enabled") oraz podanie danych dostępowych. System wysyła do AP skrypt (wykorzystując scp) a następnie uruchamia go przez ssh, co pozwala na uzyskanie danych o pracy punktu dostępowego. Status Offline urządzenia zostanie wyświetlony jeżeli urządzenie nie dostarczy danych w ciągu czasu zdefiniowanego jako 2.5 x interwał odpytywania (np. 12.5 minuty jeżeli cykl został zdefiniowany na 5 minut).
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi.png">
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi-edit.png">
 
Możliwość tworzenia nowych konfiguracji sieci Wi-Fi obejmuje domyślny stan interfejsów, wybrany band, nazwę sieci (SSID), typ szyfrowania, hasło oraz przyspisania Wi-Fi do sieci (network). Podczas wysyłania konfiguracji, jeżeli nie będzie interfejsów Wi-Fi o podanych parametach to zostanie ona utworzona. Jeżeli będzie już istaniała konfiguracja o podanym SSID, wybranym zakresie częstotliwości oraz przynależności do sieci - zostanie zaktualizowana (włączona/wyłączona, typ szyfrowania i hasło).
Aplikacja nie odczytuje ani nie usuwa z urządzeń żadnych sieci które już na nim istnieją. Obecnie umożliwia tylko definiowane nowych i aktualizowanie interfejsów bezprzewodowych.
 
Powiązanie w grupy umożliwia przypisane określonych sieci Wi-Fi do określonych urządzeń i ew wysyłkę konfiguracji. Część konfiguacji może być zignorowana w przypadku kiedy:
- urządzenie w ogóle nie będzie miało interfejsów bezprzewodowych
- urządzenie nie będzie miało interfejsów radiowych wybraj częstotliwości
- urządzenie nie będzie miało zdefiniowanej sieci (network) o podanej nazwie
 
Aplikacja umożliwia prostą konfigurację okresu odpytywania urządzenia oraz wybór wyświetlanych kolumn. W celu zapewnienia przejrzystości konfiguracji należy wbrac do wyświetlania tylko niezbędne kolumny.
 
System zapewnia uproszczone ale centralne zarządzanie punktami dostępowymi pracującymi z OpenWrt. Dzięki cyklicznemu monitoringowi można szybko reagować na problemy w sieci, a funkcja grupowania i automatycznej konfiguracji Wi-Fi pozwala na efektywne zarządzanie większą liczbą urządzeń jednocześnie. Aplikacja została zaprojektowana jako rozwiązanie lekkie, niewymagające skomplikowanych zależności i działające przy minimalnej ingerencji w same punkty dostępowe.
