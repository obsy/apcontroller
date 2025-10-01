# AP Controller - system zarządzania punktami dostępowymi (AP) dla OpenWrt/LuCI
 
[English version](README.md)
 
Aplikacja to lekki system zarządzania punktami dostępowymi (Access Points), zbudowany jako rozszerzenie dla OpenWrt/LuCI. Jej głównym celem jest monitorowanie urządzeń sieciowych oraz automatyzacja procesów tworzenia i aktualizacji sieci Wi-Fi bez konieczności instalacji dodatkowych pakietów na punktach dostępowych.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices.png">
 
Aplikacja umożliwia:
- dodawanie i definiowania urządzeń (pracujących pod kontrolą OpenWrt) oraz wprowadzenie danych dostępnych (takich jak adres IP, port, login i hasło użytkownika, adres URL do GUI)
- włączenie/wyłączenie monitorowania urządzeń oraz prezentacja parametrów ich pracy
- lista klientów bezprzewodowych połączonych do monitorowanych urządzeń z Wi-Fi
- pobieranie logów z urządzenia, możliwość rebootu i pingowania urządzenia oraz wykonywanie skryptów tworzonych przez użytkownika
- definiowanie sieci Wi-Fi
- definiowanie grup AP przez powiązanie sieci Wi-Fi oraz urządzeń
- wysyłanie konfiguracji Wi-Fi do urządzeń w grupach
- definiowanie skryptu użytkownika wykonywanego przez założeniem lub aktualizacją parametrów Wi-Fi
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices-edit.png">
 
Monitoring urządzeń odbywa się cyklicznie przez skrypt wykonywany w cronie. Aby urządzenie było monitorowane wymagane jest jego włączenie (opcja "Enabled") oraz podanie danych dostępowych. System wysyła do AP skrypt (wykorzystując scp) a następnie uruchamia go przez ssh, co pozwala na uzyskanie danych o pracy punktu dostępowego. Status Offline urządzenia zostanie wyświetlony jeżeli urządzenie nie dostarczy danych w ciągu czasu zdefiniowanego jako 2.5 x interwał odpytywania (np. 12.5 minuty jeżeli cykl został zdefiniowany na 5 minut).
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi.png">
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi-edit.png">
 
Możliwość tworzenia nowych konfiguracji sieci Wi-Fi obejmuje domyślny stan interfejsów, wybrany band, nazwę sieci (SSID), typ szyfrowania, hasło oraz przypisania Wi-Fi do sieci (network). Podczas wysyłania konfiguracji, jeżeli nie będzie interfejsów Wi-Fi o podanych paramentach to zostanie ona utworzona. Jeżeli będzie już istniała konfiguracja o podanym SSID, wybranym zakresie częstotliwości oraz przynależności do sieci - zostanie zaktualizowana (włączona/wyłączona, typ szyfrowania i hasło).
Aplikacja nie odczytuje ani nie usuwa z urządzeń żadnych sieci które już na nim istnieją. Obecnie umożliwia tylko definiowane nowych i aktualizowanie interfejsów bezprzewodowych.
 
Powiązanie w grupy umożliwia przypisane określonych sieci Wi-Fi do określonych urządzeń i ew wysyłkę konfiguracji. Część konfiguracji może być zignorowana w przypadku kiedy:
- urządzenie w ogóle nie będzie miało interfejsów bezprzewodowych
- urządzenie nie będzie miało interfejsów radiowych wybranej częstotliwości
- urządzenie nie będzie miało zdefiniowanej sieci (network) o podanej nazwie
 
Aplikacja umożliwia prostą konfigurację okresu odpytywania urządzenia oraz wybór wyświetlanych kolumn. W celu zapewnienia przejrzystości konfiguracji należy wybrać do wyświetlania tylko niezbędne kolumny.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-settings.png">
 
System zapewnia uproszczone ale centralne zarządzanie punktami dostępowymi pracującymi z OpenWrt. Dzięki cyklicznemu monitoringowi można szybko reagować na problemy w sieci, a funkcja grupowania i automatycznej konfiguracji Wi-Fi pozwala na efektywne zarządzanie większą liczbą urządzeń jednocześnie. Aplikacja została zaprojektowana jako rozwiązanie lekkie, niewymagające skomplikowanych zależności i działające przy minimalnej ingerencji w same punkty dostępowe.

## Użycie kluczy autoryzacyjnych

Autoryzacja w AP domyślnie odbywa się za pomocą pary nazwa użytkownika/hasło. Jeżeli używana jest autoryzacja z wykorzystaniem kluczy to należy nie uzupełniać pola "Hasło" (zostawić je puste). Klucze można wygenerować poleceniem (na routerze że jest zainstalowany apcontroller):
```
mkdir /root/.ssh
dropbearkey  -f /root/.ssh/id_dropbear
ssh root@192.168.1.2 "tee -a /etc/dropbear/authorized_keys" < /root/.ssh/id_dropbear.pub
ssh root@192.168.1.3 "tee -a /etc/dropbear/authorized_keys" < /root/.ssh/id_dropbear.pub
itd...
```
## Wysyłanie konfiguracji do urządzeń
System nie odczytuje bieżącej konfiguracji z urządzeń. Pozwala tylko na zdefiniowanie rozgłaszanego Wi-Fi a następnie wysłanie parametrów Wi-Fi do urządzenia. Przykład konfiguracji sieci o nazwie "OpenWrt":
- w zakładce "Devices" dodajemy wszystkie urządzenia w sieci. Po zapisaniu zmian można wybrać przycisk "Refresh" aby zobaczyć bieżące parametry pracy urządzenia
- w zakładce "Wi-Fi" należy zdefiniować sieć o dowolnej nazwie, jako "SSID" należy wpisać "OpenWrt", określić pasma na których ma się rozgłaszać oraz typ szyfrowania i klucz. Jako "Network" należy wpisać "lan" - to jest domyślna nazwa logiczna sieci lokalnej 
- w zakładce "AP Group" należy dowolnie nazwać grupę, wybrać z listy urządzenia które mają wchodzić w skład grupy, oraz wybrać listę sieci Wi-Fi którą te urządzenia mają rozgłaszać
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-apgroup-edit.png">
 
Opcja "Delete all" pozwala na całkowite usunięcie istniejących sieci Wi-Fi przez wykonywaniem zmian na urządzeniu. Usuwane są tylko sekcje konfiguracyjne z interfejsów bezprzewodowych.
Opcja "Use additional script" pozwala na używanie własnego skryptu który będzie wykonywany przed próbą założenia lub modyfikacji każdej zdefiniowanej sieci Wi-Fi na każdym paśmie
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-additionalscript.png">
 
Pozwala to użytkownikowi na samodzielnie budowanie konfiguracji sieci przewodowej, bridge czy tworzenie własnych VLANów. Skrypt musi być prawidłowym skryptem powłoki. W skrypcie można posługiwać się kilkoma zmiennymi ("$_ENABLED", "$_SSID", "$_BAND", "$_NETWORK") które będą zawierać odpowiednie parametry przekazywanej sieci Wi-Fi
- po zapisaniu zmian należy wybrać przycisk "Send" co spowoduje wysłanie i wykonanie konfiguracji na wszystkich włączonych urządzeniach zdefiniowanych w tej grupie
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-apgroup.png">
 
## Skrypty definiowane przez użytkownika
Menu urządzenia pozwala na wykonywanie akcji zawiązanych z konkretnym urządzeniem, które są definiowane jako skrypty powłoki. Domyślna konfiguracja zawiera dwa skrypty - "Log" oraz "Reboot"; użytkownik może tworzyć samodzielnie dowolny skrypt który zostanie wykonany na wskazanym routerze/AP. Skrypty należy umieścić w katalogu /usr/share/apcontroller/scripts.

Komentarz #desc: oznacza nazwę skryptu wyświetlaną na liście dostępnych skryptów. Umieszczenie #warn oznacza że przed wykonaniem skryptu zostanie zadane pytanie czy na pewno chcemy go wykonać.
