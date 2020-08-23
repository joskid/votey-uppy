import { NextApiRequest, NextApiResponse } from 'next';
import faker from 'faker';
import {
  Item,
  ItemCategory,
  ItemQueryFilters,
  ItemStatus,
} from 'services/data-types';
import { getDatabase } from 'services/database';
import { getUserFromSession } from 'services/user-dao';
import { getAllItems } from 'services/item-dao';

type PartialItem = Partial<Item>;

function generateItem({
  title = faker.lorem.words(),
  description = faker.lorem.paragraph(),
  category = faker.random.arrayElement([
    ItemCategory.Tutorial,
    ItemCategory.Opinion,
    ItemCategory.Vlog,
  ]),
  status = ItemStatus.Pending,
  createdBy = faker.random.uuid(),
}: PartialItem = {}): PartialItem {
  return {
    title,
    description,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    category,
    createdBy,
    status,
    votes: [],
  };
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const db = await getDatabase();
  const collection = db.collection('items');

  let user;
  let userIsAdmin = false;
  try {
    user = await getUserFromSession({ req });
    userIsAdmin = user.role === 'admin';
  } catch {} // eslint-disable-line no-empty

  if (req.method === 'GET') {
    const query = (req.query as unknown) as ItemQueryFilters;

    return res.status(200).json(
      await getAllItems({
        onlyPending: userIsAdmin && query.status === ItemStatus.Pending,
      })
    );
  }

  if (req.method === 'POST') {
    if (!user) {
      res.status(401).end();
      return;
    }

    const { title, description, category } = JSON.parse(req.body);

    if (!title || !description || !category) {
      res.status(400).json({ status: 'malformed content' });
      return;
    }

    const newItem = generateItem({
      title,
      description,
      category,
      createdBy: user._id,
    });

    const { result } = await collection.insertOne(newItem);

    if (!result.ok) {
      res.status(500).json({ status: 'unable to add item' });
      return;
    }

    return res.status(201).json({ status: 'created' });
  }

  res.end();
};
