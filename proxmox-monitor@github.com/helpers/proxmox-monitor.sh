#!/bin/bash

get_cpu_temp() {
    # Try to get CPU temperature from k10temp (AMD CPUs)
    if command -v sensors >/dev/null 2>&1; then
        # Try Tdie first (actual CPU die temperature)
        temp=$(sensors | grep -A 10 'k10temp' | grep 'Tdie' | awk '{print $2}' | sed 's/+//' | sed 's/°C//')
        if [ -n "$temp" ] && [ "$temp" != "0.0" ]; then
            echo "$temp"
            return 0
        fi
        
        # Try Tctl (control temperature)
        temp=$(sensors | grep -A 10 'k10temp' | grep 'Tctl' | awk '{print $2}' | sed 's/+//' | sed 's/°C//')
        if [ -n "$temp" ] && [ "$temp" != "0.0" ]; then
            echo "$temp"
            return 0
        fi
        
        # Try CPU Temperature from asus_wmi_sensors
        temp=$(sensors | grep -A 20 'asus_wmi_sensors' | grep 'CPU Temperature' | awk '{print $3}' | sed 's/+//' | sed 's/°C//')
        if [ -n "$temp" ] && [ "$temp" != "0.0" ]; then
            echo "$temp"
            return 0
        fi
        
        # Try CPU Socket Temperature
        temp=$(sensors | grep -A 20 'asus_wmi_sensors' | grep 'CPU Socket Temperature' | awk '{print $4}' | sed 's/+//' | sed 's/°C//')
        if [ -n "$temp" ] && [ "$temp" != "0.0" ]; then
            echo "$temp"
            return 0
        fi
    fi
    
    # Fallback to thermal zones
    for zone in /sys/class/thermal/thermal_zone*/temp; do
        if [ -r "$zone" ]; then
            temp=$(cat "$zone" 2>/dev/null | head -1)
            if [ -n "$temp" ] && [ "$temp" -gt 0 ]; then
                echo "$((temp / 1000))"
                return 0
            fi
        fi
    done
    
    echo "null"
}

get_hdd_temps() {
    declare -a hdd_temps
    
    # Method 1: hddtemp-lt if available (preferred)
    if command -v hddtemp-lt >/dev/null 2>&1; then
        # Use a temporary file to capture hddtemp-lt output
        hddtemp-lt 2>/dev/null > /tmp/hddtemp_output.txt
        
        # Read from the temporary file
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                # Extract the drive name and temperature
                drive_path=$(echo "$line" | awk '{print $1}')
                temp=$(echo "$line" | awk '{print $NF}')
                
                # Verify it's a number and reasonable
                if [[ "$temp" =~ ^[0-9]+$ ]] && [ "$temp" -gt 0 ] && [ "$temp" -lt 100 ]; then
                    drive_name=$(basename "$drive_path")
                    hdd_temps+=("{\"drive\":\"$drive_name\",\"temp\":$temp}")
                fi
            fi
        done < /tmp/hddtemp_output.txt
        
        # Clean up
        rm -f /tmp/hddtemp_output.txt
    fi
    
    # Method 2: If no data, try individual drives
    if [ ${#hdd_temps[@]} -eq 0 ] && command -v hddtemp-lt >/dev/null 2>&1; then
        for drive in /dev/sd?; do
            if [ -b "$drive" ]; then
                temp_output=$(hddtemp-lt "$drive" 2>/dev/null)
                if [ $? -eq 0 ] && [ -n "$temp_output" ]; then
                    temp=$(echo "$temp_output" | awk '{print $NF}')
                    if [[ "$temp" =~ ^[0-9]+$ ]] && [ "$temp" -gt 0 ] && [ "$temp" -lt 100 ]; then
                        drive_name=$(basename "$drive")
                        hdd_temps+=("{\"drive\":\"$drive_name\",\"temp\":$temp}")
                    fi
                fi
            fi
        done
    fi
    
    if [ ${#hdd_temps[@]} -eq 0 ]; then
        echo "[]"
    else
        echo "[$(IFS=,; echo "${hdd_temps[*]}")]"
    fi
}

get_system_info() {
    hostname=$(hostname)
    uptime=$(uptime -p | sed 's/^up //')
    load=$(awk '{print $1","$2","$3}' /proc/loadavg)
    
    # Get memory info
    memory_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    memory_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    memory_used=$((memory_total - memory_available))
    
    echo "{\"hostname\":\"$hostname\",\"uptime\":\"$uptime\",\"load\":\"$load\",\"memory_total\":$memory_total,\"memory_used\":$memory_used}"
}

# Main execution
cpu_temp=$(get_cpu_temp)
hdd_temps_json=$(get_hdd_temps)
system_info=$(get_system_info)

# Combine all data into JSON
echo "{
  \"cpu_temp\": $cpu_temp,
  \"hdd_temps\": $hdd_temps_json,
  \"system_info\": $system_info,
  \"timestamp\": \"$(date -Iseconds)\"
}"
