import { googleFormsService } from './src/services/googleForms';
googleFormsService.createWatch('1Z9EBHqs5kNGXWDggXrNlFblahxaJIcAHex6qywvLXc8')
  .then(console.log)
  .catch(err => {
    console.error("Watch creation failed:");
    console.error(err);
    if (err.response) {
      console.error(err.response.data);
    }
  });
