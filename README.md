# AP Controller - Access Point (AP) Management System for OpenWrt/LuCI
 
[Wersja polska](README.pl.md)
 
The application is a lightweight Access Point (AP) management system, developed as an extension for OpenWrt/LuCI. Its main purpose is to monitor network devices and automate the creation and update of Wi-Fi networks without requiring additional software packages to be installed on the access points.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices.png">
 
The application provides the following features:
- adding and defining devices (running on OpenWrt) and storing access credentials (such as IP address, port, username, and password, URL to the GUI)
- enabling/disabling device monitoring and presenting device operation parameters
- list of wireless clients connected to monitored devices with Wi-Fi
- downloading logs from the device, the ability to reboot and ping the device
- defining Wi-Fi networks
- creating AP groups by linking Wi-Fi networks and devices
- deploying Wi-Fi configurations to devices in groups
- defining a user script executed before setting up or updating Wi-Fi parameters
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-devices-edit.png">
 
Device monitoring is performed periodically by a cron-executed script. For a device to be monitored, it must be enabled (the “Enabled” option) and have valid access credentials provided. The system sends a script to the AP (via scp) and executes it through ssh, which allows retrieving operational data from the access point. A device will be displayed with Offline status if it fails to provide data within twice and half the defined polling interval (e.g., 12.5 minutes if the polling cycle is set to 5 minutes).
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi.png">
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-wifi-edit.png">
 
Creating new Wi-Fi configurations includes setting default interface state, selected band, SSID, encryption type, password, and binding the Wi-Fi interface to a specific network. When sending a configuration if no Wi-Fi interfaces matching the provided parameters exist, a new one will be created. If a configuration with the specified SSID, frequency band, and network assignment already exists, it will be updated (enabled/disabled, encryption type, and password). The application does not read or remove existing Wi-Fi configurations from devices. Currently, it only supports defining new wireless interfaces and updating existing ones.
 
Grouping allows assigning specific Wi-Fi networks to selected devices and deploying configurations. Some configuration elements may be skipped in cases where:
- the device has no wireless interfaces,
- the device does not have radio interfaces in the selected frequency range,
- the device does not have a network (logical interface) defined with the given name.
 
The application provides simple configuration of the device polling interval and selection of displayed columns. For better usability, only necessary columns should be enabled for display.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-settings.png">
 
The system offers a simplified but centralized management solution for OpenWrt-based access points. With periodic monitoring, network issues can be quickly identified, while grouping and automated Wi-Fi configuration enable efficient management of multiple devices simultaneously. The application is designed as a lightweight tool, requiring minimal dependencies and minimal interference with the access points themselves.

## Using key-based authentication

Authorization in the AP is by default performed using a username/password pair. If you are using key-based authentication, leave the "Password" field blank. Keys can be generated with the following command (on a router with apcontroller installed):
```
mkdir /root/.ssh
dropbearkey -f /root/.ssh/id_dropbear
ssh root@192.168.1.2 "tee -a /etc/dropbear/authorized_keys" < /root/.ssh/id_dropbear.pub
ssh root@192.168.1.3 "tee -a /etc/dropbear/authorized_keys" < /root/.ssh/id_dropbear.pub
etc...
```
## Sending Configuration to Devices
The system does not read the current configuration from devices. It only allows you to define the Wi-Fi network being broadcast and then send Wi-Fi parameters to the device. Example configuration for a network named "OpenWrt":
- In the "Devices" tab, add all devices in the network. After saving changes, select the "Refresh" button to view the device's current operating parameters.
- In the "Wi-Fi" tab, define a network with any name, enter "OpenWrt" as the "SSID," specify the bands on which it will broadcast, as well as the encryption type and key. For "Network," enter "lan"—this is the default logical name of the local network.
- In the "AP Group" tab, name the group as desired, select the devices to be included in the group from the list, and select the list of Wi-Fi networks these devices will advertise.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-apgroup-edit.png">
 
The "Delete all" option allows you to completely delete existing Wi-Fi networks before making changes to the device. Only the configuration sections for the wireless interfaces are deleted. 
The "Use additional script" option allows you to use a custom script that will be executed before attempting to set up or modify any defined Wi-Fi network on any band.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-additionalscript.png">
 
This allows users to independently configure wired networks, bridges, and create their own VLANs. The script must be a valid shell script. The script can use several variables ("$_ENABLED", "$_SSID", "$_BAND", "$_NETWORK") that will contain the appropriate parameters for the Wi-Fi network being forwarded.
- After saving the changes, select the "Send" button, which will send and execute the configuration on all enabled devices defined in this group.
 
<img src="https://raw.githubusercontent.com/obsy/apcontroller/refs/heads/main/img/tab-apgroup.png">
 
