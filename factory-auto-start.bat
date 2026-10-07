@echo off
cd /d E:\hidden-radiology-factory
start npm run dev
timeout /t 10
start http://localhost:3000/admin/factory
start http://localhost:3000/admin/orders
