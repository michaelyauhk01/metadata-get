import { MongoClient } from "mongodb";
import { writeFile } from "fs";
import { json2csvAsync } from "json-2-csv";
import _ from "lodash";

const OrderStatus = {
  0: "Failed",
  1: "Paid",
  2: "Pending",
  3: "Cancelled",
  4: "Unsubmitted",
  5: "Capturing",
};

const mongoUri = "";
const organizationNo = "";

const mongo = new MongoClient(mongoUri);

async function main() {
  try {
    console.log("initing mongodb");
    await mongo.connect();
    await mongo.db("admin").command({ ping: 1 });
    console.log("connected to mongo");

    const database = mongo.db("charity-service");
    const Order = database.collection("orders");
    const Project = database.collection("projects");
    const Organization = database.collection("organizations");

    const organization = await Organization.findOne({ organizationNo });
    console.log(`Queried organization: ${organization.nameChi}`);

    const projects = await Project.find({
      organizationId: organization._id,
    }).toArray();
    console.log(`Queried projects by ${organization.nameChi}`);

    const promises = _.map(projects, (project) => {
      return Order.find({
        projectId: project._id,
        walletTransactionId: { $regex: /^TXN_/ },
      }).toArray();
    });

    const orders = _.flatten(await Promise.all(promises));
    console.log(
      `Queried orders by ${organization.nameChi} that has wallet tran id starting with "TXN_"`
    );

    const metadataByOrderNo = _.map(orders, (order) => {
      const project = _.find(projects, (project) => {
        return project._id.toString() === order.projectId.toString();
      });

      return {
        transactionId: order.walletTransactionId,
        orderNo: order.orderNo,
        status: OrderStatus[order.status],
        metadata: JSON.stringify({
          projectNo: project.projectNo,
          projectTitle: project.name,
        }),
        createdAt: order.createdTime,
      };
    });

    const csv = await json2csvAsync(metadataByOrderNo);
    writeFile(`${__dirname}/csv/${organizationNo}.csv`, csv, (err) => {
      if (err) throw err;
      console.log(`finished exporting metadata report for ${organizationNo}`);
    });
  } catch (err) {
    console.log(err);
  }
}

main();
