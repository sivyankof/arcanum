# Останавливает node-процессы ЭТОГО проекта: dev-сервер Expo и осиротевшие воркеры jest.
#
# Зачем нужен. У машины много ядер, поэтому jest поднимает под каждый прогон свой процесс-воркер
# на ядро. При нормальном завершении родитель гасит их сам. Но в Windows нет групп процессов:
# если родителя снять принудительно (таймаут, закрытая сессия, Stop-Process без -T), дети об этом
# не узнают никогда и остаются жить вечно, каждый со своей памятью. 21.08 так накопилось
# 14 воркеров из ОДНОГО оборванного прогона — больше гигабайта впустую.
#
# ⚠️ Ограничивать число воркеров ради этого НЕ надо: замер 21.08 показал 2.97 с по умолчанию
# против 3.53 с при --maxWorkers=4, то есть плата ~20% на КАЖДОМ прогоне за проблему, которая
# возникает изредка. Дешевле убрать за собой этим скриптом.
#
# Скрипт Windows-специфичен (как и вся среда разработки проекта) и намеренно фильтрует процессы
# по пути репозитория: параллельно на машине работают дев-серверы других проектов, задевать их нельзя.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$needle = '*' + (Split-Path -Leaf $root) + '*'

# Берём только node.exe, у которых путь проекта в командной строке. Сам PowerShell под фильтр
# не попадает (он не node.exe), поэтому самоубийство исключено.
$procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like $needle })

if ($procs.Count -eq 0) {
  Write-Host "Процессов проекта не найдено — чисто."
  exit 0
}

Write-Host "Найдено процессов проекта: $($procs.Count)"
foreach ($p in $procs) {
  $kind = if ($p.CommandLine -like '*jest-worker*') { 'воркер jest' }
          elseif ($p.CommandLine -like '*expo*') { 'dev-сервер Expo' }
          else { 'прочее' }
  Write-Host "  PID $($p.ProcessId) — $kind"
}

foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 700

$left = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like $needle })

if ($left.Count -eq 0) {
  Write-Host "Остановлены все. Порт 8081: " -NoNewline
  $busy = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
  if ($busy) { Write-Host "ВСЁ ЕЩЁ ЗАНЯТ (PID $($busy.OwningProcess)) — это чужой процесс, не трогаю." }
  else { Write-Host "свободен." }
  exit 0
}

Write-Host "Осталось процессов: $($left.Count) — снять не удалось, посмотри вручную:"
foreach ($p in $left) { Write-Host "  PID $($p.ProcessId): $($p.CommandLine)" }
exit 1
