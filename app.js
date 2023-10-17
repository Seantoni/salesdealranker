document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("calculate").addEventListener("click", () => {
    const inputFile = document.getElementById("inputFile").files[0];
    if (!inputFile) {
      alert("Please select a CSV file");
      return;
    }

    Papa.parse(inputFile, {
      complete: processCSV,
      error: () => {
        alert("Input file format is not valid");
      }
    });
  });
});

function removeCommas(str) {
  return str.replace(/,/g, "");
}

function processCSV(results) {
  const today = new Date();
  const businessMaxDate = {};
  const businessSum = {};
  const businessCount = {};

  results.data.slice(1).forEach((row) => {
    const businessName = row[3];
    const dealDate = new Date(row[2]);
    if (!businessMaxDate[businessName] || dealDate > businessMaxDate[businessName]) {
      businessMaxDate[businessName] = dealDate;
    }
  });

  const data = results.data.slice(1).map((row) => {
    const lastDealDate = businessMaxDate[row[3]];
    const timeDifference = today - lastDealDate;
    const daysSinceLastDeal = Math.ceil(timeDifference / (1000 * 3600 * 24));
    const businessName = row[3];

    // Track sum and count for forecasting
    businessSum[businessName] = (businessSum[businessName] || { "net revenue": 0, "vouchers sold": 0 });
    businessCount[businessName] = (businessCount[businessName] || { "net revenue": 0, "vouchers sold": 0 });

    const netRevenue = +removeCommas(row[5]);
    const vouchersSold = +removeCommas(row[6]);

    businessSum[businessName]["net revenue"] += netRevenue;
    businessSum[businessName]["vouchers sold"] += vouchersSold;
    
    businessCount[businessName]["net revenue"]++;
    businessCount[businessName]["vouchers sold"]++;

    return {
      "offer id": row[0],
      "business name": businessName,
      "assigned advisor": row[4],
      "net revenue": netRevenue,
      "vouchers sold": vouchersSold,
      "sold per day": +removeCommas(row[7]),
      "Días desde ultima oferta": daysSinceLastDeal
    };
  });

  const columns = ["vouchers sold", "sold per day", "net revenue"];
  const factorWeights = [0.4, 0.3, 0.3];

  for (const column of columns) {
    const minVal = Math.min(...data.map((row) => row[column]));
    const maxVal = Math.max(...data.map((row) => row[column]));

    for (const row of data) {
      row[column] = minVal === maxVal ? 0 : (row[column] - minVal) / (maxVal - minVal);
    }
  }

  for (const row of data) {
    row["Deal Score"] = columns.reduce(
      (acc, column, index) => acc + row[column] * factorWeights[index],
      0
    );
  }

  const totalDealScore = data.reduce((acc, row) => acc + row["Deal Score"], 0);
  let cumulativeSum = 0;

  for (const row of data) {
    cumulativeSum += row["Deal Score"];
    row["Pareto"] = (cumulativeSum / totalDealScore) * 100;
  }

  const averageDealScore = totalDealScore / data.length;

  for (const row of data) {
    row["% Difference from Avg"] = ((row["Deal Score"] - averageDealScore) / averageDealScore) * 100;
  }

  data.sort((a, b) => b["Deal Score"] - a["Deal Score"]);

  function generateCSV(dataToOutput, fileName) {
    const outputCSV = Papa.unparse(dataToOutput);
    const csvBlob = new Blob([outputCSV], { type: "text/csv" });
    const csvUrl = URL.createObjectURL(csvBlob);
  
    const tempLink = document.createElement("a");
    tempLink.href = csvUrl;
    tempLink.download = fileName;
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
  }
  
  // Generate the first CSV with all data
  const allDataOutput = [
    ["Rank", "Offer ID", "Business Name", "Assigned Advisor", "Deal Score", "Días desde ultima oferta", "% Difference from Avg", "Pareto", "Forecast: Net Revenue", "Forecast: Vouchers Sold"],
    ...data.map((row, index) => generateRow(row, index))
  ];
  generateCSV(allDataOutput, "all_data_output.csv");
  
  // Generate the second CSV with only those that have "Días desde ultima oferta" over 60
  const filteredData = data.filter(row => row["Días desde ultima oferta"] > 60);
  const filteredDataOutput = [
    ["Rank", "Offer ID", "Business Name", "Assigned Advisor", "Deal Score", "Días desde ultima oferta", "% Difference from Avg", "Pareto", "Forecast: Net Revenue", "Forecast: Vouchers Sold"],
    ...filteredData.map((row, index) => generateRow(row, index))
  ];
  generateCSV(filteredDataOutput, "filtered_data_output.csv");
  
  function generateRow(row, index) {
    const businessName = row["business name"];
    const forecastNetRevenue = (businessSum[businessName]["net revenue"] / businessCount[businessName]["net revenue"]).toFixed(2);
    const forecastVouchersSold = (businessSum[businessName]["vouchers sold"] / businessCount[businessName]["vouchers sold"]).toFixed(2);
  
    return [
      index + 1,
      row["offer id"],
      row["business name"],
      row["assigned advisor"],
      row["Deal Score"].toFixed(2),
      row["Días desde ultima oferta"],
      row["% Difference from Avg"].toFixed(2),
      row["Pareto"].toFixed(2),
      forecastNetRevenue,
      forecastVouchersSold
    ];
  }

  const outputCSV = Papa.unparse(outputData);

  const csvBlob = new Blob([outputCSV], { type: "text/csv" });
  const csvUrl = URL.createObjectURL(csvBlob);

  const tempLink = document.createElement("a");
  tempLink.href = csvUrl;
  tempLink.download = "output_file.csv";
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
}
