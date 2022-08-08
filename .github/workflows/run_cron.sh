echo "Starting..."
cd ../../
git fetch
git checkout main
git pull

echo "Installing dependencies..."
npm i
echo "Installing dependencies... Done"

echo "Running scripts..."
npx ts-node src/main.ts -y
## alternative way:
# tsc src/main.ts
# node src/main.js
echo "Running scripts... Done"

echo "Unzipping..."
cd data/whoisds
while read -r line; do (unzip -o -d "$(basename "$line" .zip)" "$line"); done < <(find . | grep '.zip')

echo "Removing temporary Zip files..."
rm *.zip

date --iso-8601=seconds > last_update.txt
cd ..
echo "Done!"


echo "Updating repo..."

git add -A && git commit -m "Updated files via script" 
git push
echo "Updating repo... Done"

echo "Press any key to exit..."