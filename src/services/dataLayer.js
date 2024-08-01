const { ObjectId } = require('mongodb');
const { createCollectionInstance } = require('../config/mongodb');
const { getTimestamp } = require('../helpers/index.js');

class Db {
  constructor(collection, reqUser = null) {
    this.collection = collection;
    this.reqUser = reqUser;
    this.collectionInstance = null;
  }

  async attachCollectionInstance() {
    if (!this.collectionInstance) {
      this.collectionInstance = await createCollectionInstance(this.collection);
    }
  }

  generateMetadata(data) {
    const unixTimestamp = getTimestamp();
    return {
      ...data,
      createdAt: unixTimestamp,
      updatedAt: unixTimestamp,
      ...(this.reqUser && {
        createdBy: new ObjectId(this.reqUser._id),
        updatedBy: new ObjectId(this.reqUser._id),
      }),
    };
  }

  async insertOne(data) {
    await this.attachCollectionInstance();
    const insertData = this.generateMetadata(data);
    const { insertedId } = await this.collectionInstance.insertOne(insertData);
    return { insertedId, insertData };
  }

  async insertMany(data) {
    await this.attachCollectionInstance();
    const { insertedIds } = await this.collectionInstance.insertMany(data);
    return insertedIds;
  }

  async findOne(filter, projection = {}) {
    await this.attachCollectionInstance();
    return this.collectionInstance.findOne(filter, { projection });
  }

  async find(filter, options = {}) {
    await this.attachCollectionInstance();

    const { projection, sort = { createdAt: 1 }, skip = 0, limit = 15 } = options;
    const docCount = await this.collectionInstance.countDocuments(filter);
    const result = await this.collectionInstance
      .find(filter)
      .project(projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const currentPage = Math.ceil(skip / limit) + 1;
    const totalPages = Math.ceil(docCount / limit);

    return {
      result,
      docCount,
      skip,
      limit,
      currentPage,
      totalPages,
      hasNextPage: limit * currentPage < docCount,
    };
  }

  async update(filter, updateObject, options = {}) {
    await this.attachCollectionInstance();

    const unixTimestamp = getTimestamp();
    const updatedFields = {
      ...updateObject,
      $set: {
        ...updateObject.$set,
        updatedAt: unixTimestamp,
        ...(this.reqUser && { updatedBy: new ObjectId(this.reqUser._id) }),
      },
    };

    const defaultOpts = {
      upsert: false,
      returnDocument: 'after',
    };

    if (options.many) {
      return this.collectionInstance.updateMany(filter, updatedFields, {
        ...defaultOpts,
        ...options,
      });
    } else {
      return this.collectionInstance.findOneAndUpdate(filter, updatedFields, {
        ...defaultOpts,
        ...options,
      });
    }
  }

  async updateMany(filter, updateObject, arrayFilters = null) {
    await this.attachCollectionInstance();

    const unixTimestamp = getTimestamp();

    updateObject.$set = updateObject.$set || { updatedAt: unixTimestamp };
    updateObject.$set.updatedAt = updateObject.$set.updatedAt || unixTimestamp;
    if (this.reqUser !== null) {
      updateObject.$set.updatedBy = new ObjectId(this.reqUser._id);
    }
    const result = await this.collectionInstance.updateMany(
      filter,
      {
        ...updateObject,
      },
      {
        arrayFilters,
        upsert: false,
        returnDocument: 'after',
      },
    );

    return result;
  }

  async updateOne(filter, updateObject, options = {}) {
    await this.attachCollectionInstance();

    const unixTimestamp = getTimestamp();
    const updatedFields = {
      ...updateObject,
      $set: {
        ...updateObject.$set,
        updatedAt: unixTimestamp,
        ...(this.reqUser && { updatedBy: new ObjectId(this.reqUser._id) }),
      },
    };

    const defaultOpts = {
      upsert: false,
      returnDocument: 'after',
    };

    return this.collectionInstance.findOneAndUpdate(filter, updatedFields, {
      ...defaultOpts,
      ...options,
    });
  }

  async aggregate(pipeline, collation = {}) {
    await this.attachCollectionInstance();
    return this.collectionInstance.aggregate(pipeline, collation).toArray();
  }

  async deleteOne(filter) {
    await this.attachCollectionInstance();
    return this.collectionInstance.findOneAndDelete(filter);
  }

  async deleteMany(filter) {
    await this.attachCollectionInstance();
    return this.collectionInstance.deleteMany(filter);
  }
}

module.exports = Db;
