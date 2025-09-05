# AP Controller - Access Point (AP) Management System for OpenWrt/LuCI
 
[Wersja polska](README.pl.md)
 
The application is a lightweight Access Point (AP) management system, developed as an extension for OpenWrt/LuCI. Its main purpose is to monitor network devices and automate the creation and update of Wi-Fi networks without requiring additional software packages to be installed on the access points.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices.png">
 
The application provides the following features:
- adding and defining devices (running on OpenWrt) and storing access credentials (such as IP address, port, username, and password).
- dnabling/disabling device monitoring and presenting device operation parameters.
- defining Wi-Fi networks.
- creating AP groups by linking Wi-Fi networks and devices.
- deploying network configurations to enabled devices.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices-edit.png">
 
Device monitoring is performed periodically by a cron-executed script. For a device to be monitored, it must be enabled (the “Enabled” option) and have valid access credentials provided. The system sends a script to the AP (via scp) and executes it through ssh, which allows retrieving operational data from the access point. A device will be displayed with Offline status if it fails to provide data within twice the defined polling interval (e.g., 10 minutes if the polling cycle is set to 5 minutes).
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi.png">
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi-edit.png">
 
Creating new Wi-Fi configurations includes setting default interface state, selected band, SSID, encryption type, password, and binding the Wi-Fi interface to a specific network. When sending a configuration if no Wi-Fi interfaces matching the provided parameters exist, a new one will be created. If a configuration with the specified SSID, frequency band, and network assignment already exists, it will be updated (enabled/disabled, encryption type, and password). The application does not read or remove existing Wi-Fi configurations from devices. Currently, it only supports defining new wireless interfaces and updating existing ones.
 
Grouping allows assigning specific Wi-Fi networks to selected devices and deploying configurations. Some configuration elements may be skipped in cases where:
- the device has no wireless interfaces,
- the device does not have radio interfaces in the selected frequency range,
- the device does not have a network (logical interface) defined with the given name.
 
The application provides simple configuration of the device polling interval and selection of displayed columns. For better usability, only necessary columns should be enabled for display.
 
The system offers a simplified but centralized management solution for OpenWrt-based access points. With periodic monitoring, network issues can be quickly identified, while grouping and automated Wi-Fi configuration enable efficient management of multiple devices simultaneously. The application is designed as a lightweight tool, requiring minimal dependencies and minimal interference with the access points themselves.
