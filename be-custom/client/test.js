const {getUserById} = require('../src/repositories/userRepository');

async function test() {
  try {
    const user1 = await getUserById(1);
    const user2 = await getUserById(2);

    
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}